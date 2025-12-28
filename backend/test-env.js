// Test if .env is loading correctly
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '../.env') })

console.log('Working directory:', process.cwd())
console.log('.env path:', path.join(process.cwd(), '../.env'))
console.log('ENABLE_MULTI_TIER:', process.env.ENABLE_MULTI_TIER)
console.log('ENABLE_CLIP:', process.env.ENABLE_CLIP)
console.log('ENABLE_CLIP_DISAGREEMENT:', process.env.ENABLE_CLIP_DISAGREEMENT)
console.log('Type of ENABLE_MULTI_TIER:', typeof process.env.ENABLE_MULTI_TIER)
console.log('=== true?', process.env.ENABLE_MULTI_TIER === 'true')
