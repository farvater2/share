import { Hono, Context } from 'hono'
import { serve } from '@hono/node-server'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ---------- ES Module dirname ----------
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------- Constants ----------
const app = new Hono()
const NOTE_FILE = path.join(__dirname, 'note.txt')
const UPLOAD_DIR = path.join(__dirname, 'uploads')

async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

// ---------- Helpers ----------
async function readNote(): Promise<string> {
  try {
    return await fs.readFile(NOTE_FILE, 'utf-8')
  } catch {
    return ''
  }
}

async function writeNote(content: string): Promise<void> {
  await fs.writeFile(NOTE_FILE, content, 'utf-8')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function sanitizeFilename(filename: string): string {
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '')
}

async function getUploadedFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(UPLOAD_DIR)
    return files.filter((f: string) => f !== '.gitkeep')
  } catch {
    return []
  }
}

// ---------- Routes ----------

// Main page
app.get('/', async (c: Context) => {
  await ensureUploadDir()
  const currentNote = await readNote()
  const files = await getUploadedFiles()

  let fileListHtml = ''
  if (files.length === 0) {
    fileListHtml = '<p class="empty">No files yet</p>'
  } else {
    fileListHtml = '<ul class="file-list">'
    for (const f of files) {
      const safeName = encodeURIComponent(f)
      fileListHtml += `
        <li>
          <span>📄 ${escapeHtml(f)}</span>
          <div class="file-actions">
            <a href="/files/${safeName}" class="download-link">⬇</a>
            <button class="delete-btn" data-filename="${safeName}">✕</button>
          </div>
        </li>`
    }
    fileListHtml += '</ul>'
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sticker</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #2c3e50; }

    .container {
      display: flex;
      height: 100vh;
      width: 100vw;
      background: #ffffff;
    }

    .note-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 1.2rem 1.2rem 1.2rem 1.5rem;
      background: #fafbfc;
      border-right: 1px solid #e9edf2;
    }
    .note-pane form {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .note-pane textarea {
      flex: 1;
      width: 100%;
      padding: 1rem;
      border: none;
      border-radius: 12px;
      background: #ffffff;
      font-size: 0.95rem;
      line-height: 1.6;
      resize: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .note-pane textarea:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(160, 170, 184, 0.2);
    }
    .note-pane .actions {
      margin-top: 0.8rem;
      display: flex;
      justify-content: flex-end;
    }

    .files-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 1.2rem 1.5rem 1.2rem 1.2rem;
      background: #fafbfc;
    }
    .files-pane .upload-form {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .files-pane input[type="file"] {
      flex: 1;
      min-width: 160px;
      padding: 0.5rem;
      border: 1px dashed #bcc3cd;
      border-radius: 30px;
      background: #ffffff;
      font-size: 0.85rem;
    }
    .files-pane input[type="file"]:hover {
      border-color: #8f9aa8;
    }
    .files-pane .file-list-wrap {
      flex: 1;
      overflow-y: auto;
    }
    .file-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .file-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.6rem 0.2rem;
      border-bottom: 1px solid #e9edf2;
    }
    .file-list li:last-child {
      border-bottom: none;
    }
    .file-list li span {
      font-size: 0.9rem;
      word-break: break-all;
      margin-right: 1rem;
    }
    .file-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .file-actions a,
    .file-actions button {
      background: #e9edf2;
      padding: 0.2rem 0.6rem;
      border-radius: 30px;
      text-decoration: none;
      color: #2c3e50;
      font-size: 0.8rem;
      transition: background 0.2s;
      border: none;
      cursor: pointer;
    }
    .file-actions a:hover {
      background: #d5dce4;
    }
    .file-actions button {
      background: #f5e6e6;
      color: #b33;
    }
    .file-actions button:hover {
      background: #f0d0d0;
    }
    .empty {
      color: #888;
      font-style: italic;
      margin-top: 1rem;
    }

    .btn {
      display: inline-block;
      padding: 0.5rem 1.4rem;
      border: none;
      border-radius: 30px;
      font-weight: 500;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      background: #e1e6ec;
      color: #2c3e50;
    }
    .btn:hover {
      background: #d0d7de;
    }
    .btn:active {
      transform: scale(0.97);
    }
    .btn-primary {
      background: #2c3e50;
      color: #fff;
    }
    .btn-primary:hover {
      background: #1e2b38;
    }

    @media (max-width: 720px) {
      .container {
        flex-direction: column;
        height: 100vh;
      }
      .note-pane {
        border-right: none;
        border-bottom: 1px solid #e9edf2;
        padding: 1rem;
        flex: 1 1 50%;
      }
      .files-pane {
        padding: 1rem;
        flex: 1 1 50%;
      }
      .note-pane textarea {
        min-height: 120px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="note-pane">
      <form method="POST" action="/">
        <textarea name="note_content">${escapeHtml(currentNote)}</textarea>
        <div class="actions">
          <button type="submit" class="btn btn-primary">Save Note</button>
        </div>
      </form>
    </div>

    <div class="files-pane">
      <div class="upload-form">
        <form method="POST" action="/files" enctype="multipart/form-data" style="display:contents;">
          <input type="file" name="file" required />
          <button type="submit" class="btn">Upload</button>
        </form>
      </div>
      <div class="file-list-wrap">
        ${fileListHtml}
      </div>
    </div>
  </div>

  <script>
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filename = btn.dataset.filename;
        if (!confirm(\`Delete "\${decodeURIComponent(filename)}" ?\`)) return;
        try {
          const res = await fetch(\`/files/\${filename}\`, { method: 'DELETE' });
          if (res.ok) {
            location.reload();
          } else {
            const text = await res.text();
            alert('Failed to delete: ' + text);
          }
        } catch (e) {
          alert('Error: ' + e.message);
        }
      });
    });
  </script>
</body>
</html>`
  return c.html(html)
})

// POST – save note
app.post('/', async (c: Context) => {
  const body = await c.req.parseBody()
  const content = (body['note_content']?.toString()) || ''
  await writeNote(content)
  return c.redirect('/')
})

// POST – upload file
app.post('/files', async (c: Context) => {
  await ensureUploadDir()
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return c.text('No file uploaded or invalid file.', 400)
  }

  const originalName = file.name || 'unnamed'
  const safeName = sanitizeFilename(originalName)
  if (!safeName) {
    return c.text('Invalid filename.', 400)
  }

  const timestamp = Date.now()
  const ext = path.extname(safeName)
  const base = path.basename(safeName, ext)
  const finalName = `${base}_${timestamp}${ext}`
  const filePath = path.join(UPLOAD_DIR, finalName)

  const arrayBuffer = await file.arrayBuffer()
  await fs.writeFile(filePath, new Uint8Array(arrayBuffer))

  return c.redirect('/')
})

// DELETE – remove file
app.delete('/files/:filename', async (c: Context) => {
  const filename = c.req.param('filename') || ''
  const safeName = sanitizeFilename(filename)
  if (!safeName) {
    return c.text('Invalid filename.', 400)
  }

  const filePath = path.join(UPLOAD_DIR, safeName)
  try {
    await fs.unlink(filePath)
    return c.text('Deleted', 200)
  } catch {
    return c.text('File not found or cannot be deleted.', 404)
  }
})

// GET – download / view file
app.get('/files/:filename', async (c: Context) => {
  const filename = c.req.param('filename') || ''
  const safeName = sanitizeFilename(filename)
  if (!safeName) {
    return c.text('Invalid filename.', 400)
  }

  const filePath = path.join(UPLOAD_DIR, safeName)
  try {
    await fs.access(filePath)
    const fileBuffer = await fs.readFile(filePath)

    const ext = path.extname(safeName).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.txt': 'text/plain',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
      '.ttf': 'font/ttf',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.7z': 'application/x-7z-compressed',
      '.rar': 'application/vnd.rar',
      '.mih': 'application/octet-stream',
    }
    const contentType = mimeMap[ext] || 'application/octet-stream'

    const inlineTypes = ['image/', 'text/html', 'font/']
    const isInline = inlineTypes.some(t => contentType.startsWith(t))
    const disposition = isInline
      ? `inline; filename="${encodeURIComponent(safeName)}"`
      : `attachment; filename="${encodeURIComponent(safeName)}"`

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
      },
    })
  } catch {
    return c.text('File not found.', 404)
  }
})

// ---------- Server ----------
const port = Number(process.env.PORT) || 3000
serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server running at http://localhost:${info.port}`)
  }
)