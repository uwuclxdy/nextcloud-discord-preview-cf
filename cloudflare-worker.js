/**
 * Cloudflare Worker for Discord Video Previews
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  const shareMatch = url.pathname.match(/\/s\/([a-zA-Z0-9]+)/)
  if (!shareMatch) {
    return fetch(request)
  }

  const shareToken = shareMatch[1]
  const videoUrl = `https://YOUR-DOMAIN.com/public.php/dav/files/${shareToken}/?accept=zip`

  const response = await fetch(request)
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('text/html')) {
    return response
  }

  const html = await response.text()

  const filenameMatch = html.match(/id="initial-state-files_sharing-filename" value="([^"]+)"/)
  if (!filenameMatch) {
    return new Response(html, response)
  }

  let filename = 'video.mp4'
  try {
    filename = JSON.parse(atob(filenameMatch[1]))
  } catch (e) {
    return new Response(html, response)
  }

  if (!filename.match(/\.(mp4|webm|mov)$/i)) {
    return new Response(html, response)
  }

  let modifiedHtml = html

  modifiedHtml = modifiedHtml.replace(/<meta[^>]+property="og:type"[^>]+content="object"[^>]*>/gi, '')

  modifiedHtml = modifiedHtml.replace(/<meta[^>]+property="og:type"[^>]+content="video\.movie"[^>]*>/gi, '')

  modifiedHtml = modifiedHtml.replace(/<meta[^>]+property="og:video:[^"]*"[^>]*>/gi, '')

  modifiedHtml = modifiedHtml.replace(/<meta[^>]+name="twitter:(player|card)"[^>]*>/gi, '')

  const videoTags = `
    <!-- Discord Video Preview Tags (Cloudflare Worker) -->
    <meta property="og:type" content="video.movie">
    <meta property="og:video:url" content="${videoUrl}">
    <meta property="og:video:secure_url" content="${videoUrl}">
    <meta property="og:video:type" content="video/mp4">
    <meta property="og:video:width" content="1920">
    <meta property="og:video:height" content="1080">
    <meta name="twitter:card" content="player">
    <meta name="twitter:player" content="${videoUrl}">
    <meta name="twitter:player:stream" content="${videoUrl}">
    <meta name="twitter:player:width" content="1920">
    <meta name="twitter:player:height" content="1080">
  `

  modifiedHtml = modifiedHtml.replace('</head>', videoTags + '\n</head>')

  return new Response(modifiedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
}
