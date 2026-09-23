import { fuenteDeCatalogo } from "../../compartido/catalogo";
import { CATALOGO } from "./catalogo";

/**
 * Los precios del catálogo compilado, en la forma que pide `cotizar`.
 *
 * Es la misma función con la que cobra la Lambda (`fuenteDeCatalogo`), solo que
 * aquí se alimenta de la copia que compiló la tienda y allá de DynamoDB. Lo
 * oculto y lo agotado no se cotiza en ninguno de los dos lados.
 */
export const FUENTE_TIENDA = fuenteDeCatalogo(CATALOGO);
