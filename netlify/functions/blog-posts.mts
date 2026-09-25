import type { Config } from '@netlify/functions'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface Post {
  filename: string
  title: string
  date: string
  description: string
  body: string
}

function parsePost(filename: string, raw: string): Post {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) {
    return { filename, title: '', date: '', description: '', body: raw.trim() }
  }

  const lines = match[1].split(/\r?\n/)
  const data: Record<string, string> = {}
  let i = 0
  while (i < lines.length) {
    const kv = lines[i].match(/^(\w+):\s*(.*)$/)
    if (!kv) {
      i++
      continue
    }
    const key = kv[1]
    let value = kv[2].trim()
    if (value.startsWith('"') && !value.endsWith('"')) {
      let j = i + 1
      while (j < lines.length) {
        value += ' ' + lines[j].trim()
        const closed = lines[j].trim().endsWith('"')
        j++
        if (closed) break
      }
      i = j - 1
    }
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    data[key] = value
    i++
  }

  return {
    filename,
    title: data.title ?? '',
    date: data.date ?? '',
    description: data.description ?? '',
    body: raw.slice(match[0].length).trim(),
  }
}

function findBlogDir(): string {
  const candidates = [
    path.join(process.cwd(), 'blog'),
    fileURLToPath(new URL('../../blog', import.meta.url)),
  ]
  for (const dir of candidates) {
    try {
      readdirSync(dir)
      return dir
    } catch {
      // try next candidate
    }
  }
  return candidates[0]
}

export default async () => {
  let posts: Post[] = []
  try {
    const blogDir = findBlogDir()
    const filenames = readdirSync(blogDir).filter((f) => f.endsWith('.md'))
    posts = filenames.map((filename) => parsePost(filename, readFileSync(path.join(blogDir, filename), 'utf-8')))
    posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  } catch (err) {
    console.error('Failed to read blog posts', err)
  }

  return Response.json(posts)
}

export const config: Config = {
  path: '/api/blog-posts',
}
