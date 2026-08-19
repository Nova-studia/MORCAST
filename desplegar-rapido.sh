#!/usr/bin/env bash
# Deploy rápido: compila AQUÍ y sube el resultado.
#
# Por qué existe: el droplet tiene 458 MB de RAM y compila en la misma máquina
# que sirve el sitio. Un `deploy.sh` normal tarda ~28 minutos, se va a swap y
# durante todo ese rato la página responde en 2-3 segundos en vez de 0.5. Es
# decir: cada actualización tumbaba la experiencia de quien estuviera usando
# morcast.mx. Compilar aquí tarda ~35 segundos.
#
# Uso:  bash desplegar-rapido.sh
#
# Si algo sale mal, en el servidor queda `.next.anterior` para volver atrás:
#   ssh root@IP "cd /var/www/morcast/Web && rm -rf .next && mv .next.anterior .next && pm2 restart morcast"

set -euo pipefail

SERVIDOR="root@161.35.0.140"
LLAVE="$HOME/.ssh/morcast_deploy"
REMOTO="/var/www/morcast"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ssh_() { ssh -i "$LLAVE" -o ConnectTimeout=20 "$SERVIDOR" "$@"; }

echo "==> 1/6  Comprobando que no haya nada sin subir a GitHub"
cd "$AQUI"
if [ -n "$(git status --porcelain)" ]; then
  echo "    Hay cambios sin confirmar. El servidor va a hacer 'git pull' y"
  echo "    quedaría con un código distinto al que estoy compilando. Confirma"
  echo "    y sube primero."
  git status --short
  exit 1
fi
COMMIT=$(git rev-parse --short HEAD)
git fetch -q origin
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "    Tu rama y GitHub no coinciden. Haz push primero."
  exit 1
fi
echo "    ok, commit $COMMIT"

echo "==> 2/6  Compilando aquí (esto es lo que antes se hacía en el droplet)"
cd "$AQUI/Web"
npm run build >/tmp/build-local.log 2>&1 || { echo "    FALLÓ la compilación:"; tail -25 /tmp/build-local.log; exit 1; }
echo "    ok, $(grep -c '^├\|^└' /tmp/build-local.log || echo '?') rutas"

echo "==> 3/6  Empaquetando solo lo que hace falta para arrancar"
# `cache`, `dev`, `trace` y `diagnostics` son de la compilación, no del
# arranque: mandarlos multiplicaría el tamaño por diez sin ningún efecto.
rm -f /tmp/next-build.tgz
tar --exclude='./cache' --exclude='./dev' --exclude='./trace*' --exclude='./diagnostics' \
    -czf /tmp/next-build.tgz -C .next .
echo "    $(du -h /tmp/next-build.tgz | cut -f1)"

echo "==> 4/6  Subiendo al servidor"
scp -i "$LLAVE" -q /tmp/next-build.tgz "$SERVIDOR:/tmp/next-build.tgz"

echo "==> 5/6  Poniéndolo en su lugar y reiniciando"
# El `git pull` deja el CÓDIGO FUENTE del servidor igual al que compilé. Si
# cambiaron las dependencias, hay que instalarlas: el .next que subo espera
# encontrarlas. Es la única parte que puede tardar.
ssh_ "set -e
  cd $REMOTO
  ANTES=\$(md5sum Web/package-lock.json | cut -d' ' -f1)
  git pull -q
  DESPUES=\$(md5sum Web/package-lock.json | cut -d' ' -f1)
  cd $REMOTO/Web
  if [ \"\$(git rev-parse --short HEAD)\" != \"$COMMIT\" ]; then
    echo \"    OJO: el servidor quedó en \$(git rev-parse --short HEAD), no en $COMMIT\"; exit 1
  fi
  if [ \"\$ANTES\" != \"\$DESPUES\" ]; then
    echo '    cambiaron las dependencias, instalando (esta parte sí tarda)'
    npm ci >/dev/null 2>&1
  fi
  rm -rf .next.anterior
  [ -d .next ] && mv .next .next.anterior || true
  mkdir -p .next && tar -xzf /tmp/next-build.tgz -C .next
  rm -f /tmp/next-build.tgz
  pm2 restart morcast --update-env >/dev/null
  echo \"    commit en servidor: \$(git rev-parse --short HEAD)\"
"

echo "==> 6/6  Comprobando que responda"
sleep 6
for r in / /portal/login /admin/login /chofer/login; do
  printf "    %-16s " "$r"
  curl -s -o /dev/null -w "%{http_code}  %{time_total}s\n" "https://morcast.mx$r" --max-time 25
done
echo
echo "Listo. Si algo se ve mal, para volver atrás:"
echo "  ssh -i $LLAVE $SERVIDOR \"cd $REMOTO/Web && rm -rf .next && mv .next.anterior .next && pm2 restart morcast\""
