import type { Byte } from "./byte";

export function randomByte(): Byte {
    return randomInt(256) as Byte;
}

// Utility functions
export function randomInt(range: number) {
    return Math.floor(Math.random() * range);
}

export function shuffle(array: any[]) {
    let currentIndex = array.length;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      let randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  }
  