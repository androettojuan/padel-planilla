import { doc, collection } from 'firebase/firestore'
import { db } from './config'

// Todos los datos de un club cuelgan de clubs/{clubId}. Estos helpers son el
// único lugar donde se arma esa ruta, así ningún módulo la escribe a mano.
export const clubDocRef = (clubId) => doc(db, 'clubs', clubId)
export const clubCol = (clubId, name) => collection(db, 'clubs', clubId, name)
export const clubDoc = (clubId, name, id) => doc(db, 'clubs', clubId, name, id)

// Modo demo / sin Firebase: las claves de localStorage también se separan por
// club para que probar con varios no mezcle datos.
export const lsKey = (clubId, name) => `club:${clubId}:${name}`
