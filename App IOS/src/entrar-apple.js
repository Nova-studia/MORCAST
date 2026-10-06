import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { supabase, haySupabase } from "./supabase";
import { destinoDeUsuario } from "./sesion";
import { mensajeDeError, nombreDeApple, nombreParaGuardar } from "./entrada-social.mjs";

/**
 * "CONTINUAR CON APPLE" — SÓLO EN EL IPHONE.
 *
 * La App Store lo exige (guía 4.8) en cuanto la app ofrece entrar con Google.
 * Funciona también en Expo Go (allá el token sale a nombre de
 * host.exp.Exponent, que Supabase acepta sólo si ese ID está dado de alta en
 * el proveedor Apple; en la app de la tienda sale a nombre de mx.morcast.app).
 *
 * EL NONCE (la pieza que más se equivoca, igual que en la web):
 *   · A Apple se le manda el nonce CIFRADO (SHA-256 en hexadecimal).
 *   · A Supabase se le manda el nonce CRUDO; Supabase lo cifra y compara con
 *     lo que trae el token. Al revés no entra nadie.
 *
 * ⚠️ La app de Android lleva un `entrar-apple.js` de mentiras (sin módulo de
 * Apple) para que `BotonesSociales.js` sea idéntico en las dos apps.
 */

/** Texto aleatorio en hexadecimal. 32 bytes = 256 bits. */
function nonceCrudo() {
  return Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** ¿Este teléfono puede entrar con Apple? (iOS 13+ y con base configurada) */
export function useAppleDisponible() {
  const [disponible, setDisponible] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (Platform.OS !== "ios" || !haySupabase()) return undefined;
    AppleAuthentication.isAvailableAsync()
      .then((si) => { if (vivo) setDisponible(Boolean(si)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  return disponible;
}

/** El botón OFICIAL de Apple (la guía de interfaz de Apple no deja dibujar uno propio). */
export function BotonApple({ onPress, style }) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      // Blanco sobre el fondo oscuro de la app, como pide Apple.
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={11}
      style={[{ width: "100%", height: 48 }, style]}
      onPress={onPress}
    />
  );
}

/**
 * Entra con Apple. Mismo contrato que `entrarConGoogle`:
 * `{ ok: true, modo, perfil }`, `{ ok: false, cancelado: true }` o
 * `{ ok: false, mensaje }`. Nunca lanza.
 */
export async function entrarConApple() {
  if (Platform.OS !== "ios" || !haySupabase()) {
    return { ok: false, mensaje: "Entrar con Apple no está disponible en este teléfono." };
  }
  const falla = (e) => {
    const mensaje = mensajeDeError(e, { proveedor: "Apple" });
    return mensaje ? { ok: false, mensaje } : { ok: false, cancelado: true };
  };

  try {
    const crudo = nonceCrudo();
    const cifrado = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, crudo);

    const credencial = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: cifrado,
    });
    if (!credencial?.identityToken) {
      console.warn("[apple] Apple no entregó identityToken.");
      return falla(new Error("sin identityToken"));
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credencial.identityToken,
      nonce: crudo,
    });
    if (error || !data?.user) {
      console.warn("[apple] Supabase no aceptó el token:", error?.message);
      return falla(error || new Error("sin usuario"));
    }

    // Apple da el nombre SÓLO la primera vez; si no se guarda ahora, ya no
    // vuelve. Va a `user_metadata` (lo que la app y la web ya leen). Si no se
    // puede guardar, se entra igual: el nombre no es requisito.
    let usuario = data.user;
    const cambios = nombreParaGuardar(usuario, nombreDeApple(credencial.fullName));
    if (cambios) {
      const r = await supabase.auth.updateUser({ data: cambios }).catch((e) => ({ error: e }));
      if (r?.data?.user) usuario = r.data.user;
      else console.warn("[apple] No se pudo guardar el nombre:", r?.error?.message);
    }

    return { ok: true, ...(await destinoDeUsuario(usuario)) };
  } catch (e) {
    console.warn("[apple] No se pudo entrar:", e?.code, e?.message);
    return falla(e);
  }
}
