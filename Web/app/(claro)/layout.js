import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import BotonWhatsApp from "@/components/BotonWhatsApp";
import TransicionPagina from "@/components/TransicionPagina";

/** Layout del sitio público (opción A): navbar claro + footer. */
export default function LayoutClaro({ children }) {
  return (
    <>
      <NavBar />
      {/* La transición envuelve solo el contenido: el navbar y el botón de
          WhatsApp son fijos y no deben moverse con la animación. */}
      <main>
        <TransicionPagina>{children}</TransicionPagina>
      </main>
      <Footer />
      <BotonWhatsApp />
    </>
  );
}
