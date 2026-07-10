export type PassageCategory = 'quotes' | 'pangrams' | 'code'

export interface Passage {
  id: string
  category: PassageCategory
  text: string
}

export const passages: Passage[] = [
  // --- quotes ---
  { id: 'q1', category: 'quotes', text: 'The only way to do great work is to love what you do.' },
  { id: 'q2', category: 'quotes', text: 'Life is what happens to you while you are busy making other plans.' },
  { id: 'q3', category: 'quotes', text: 'In the middle of difficulty lies opportunity.' },
  { id: 'q4', category: 'quotes', text: 'It is during our darkest moments that we must focus to see the light.' },
  { id: 'q5', category: 'quotes', text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.' },
  { id: 'q6', category: 'quotes', text: 'The future belongs to those who believe in the beauty of their dreams.' },
  { id: 'q7', category: 'quotes', text: 'Whether you think you can or you think you cannot, you are right.' },

  // --- pangrams ---
  { id: 'p1', category: 'pangrams', text: 'The quick brown fox jumps over the lazy dog.' },
  { id: 'p2', category: 'pangrams', text: 'Pack my box with five dozen liquor jugs.' },
  { id: 'p3', category: 'pangrams', text: 'How vexingly quick daft zebras jump!' },
  { id: 'p4', category: 'pangrams', text: 'The five boxing wizards jump quickly.' },
  { id: 'p5', category: 'pangrams', text: 'Jinxed wizards pluck ivy from the big quilt.' },
  { id: 'p6', category: 'pangrams', text: 'Sphinx of black quartz, judge my vow.' },
  { id: 'p7', category: 'pangrams', text: 'Waltz, bad nymph, for quick jigs vex.' },

  // --- code ---
  { id: 'c1', category: 'code', text: 'function add(a, b) { return a + b; }' },
  { id: 'c2', category: 'code', text: 'const users = data.filter(u => u.active).map(u => u.name);' },
  { id: 'c3', category: 'code', text: 'for (let i = 0; i < arr.length; i++) { console.log(arr[i]); }' },
  { id: 'c4', category: 'code', text: 'if (value === null || value === undefined) { return defaultValue; }' },
  { id: 'c5', category: 'code', text: 'export default function App() { return <div>Hello</div>; }' },
  { id: 'c6', category: 'code', text: 'const result = await fetch(url).then(res => res.json());' },
  { id: 'c7', category: 'code', text: 'class Node { constructor(value) { this.value = value; this.next = null; } }' },
]

export function getRandomPassage(category: PassageCategory, excludeId?: string): Passage {
  const options = passages.filter((p) => p.category === category && p.id !== excludeId)
  const pool = options.length > 0 ? options : passages.filter((p) => p.category === category)
  return pool[Math.floor(Math.random() * pool.length)]
}
