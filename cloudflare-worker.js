/**
 * Cloudflare Worker for Discord Video Previews
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const shareMatch = url.pathname.match(/\/s\/([a-zA-Z0-9]+)/)
  if (!shareMatch) return fetch(request)

  const shareToken = shareMatch[1]
  const upstreamVideoUrl = `https://YOUR-DOMAIN.com/public.php/dav/files/${shareToken}/?accept=zip`
  const proxiedVideoUrl = `${url.origin}/s/${shareToken}?video=1`

  if (url.searchParams.get('video') === '1') {
    const upstreamHeaders = new Headers(request.headers)
    upstreamHeaders.delete('cookie')
    upstreamHeaders.delete('authorization')
    const upstreamMethod = request.method === 'HEAD' ? 'GET' : request.method

    const upstreamResponse = await fetch(upstreamVideoUrl, {
      method: upstreamMethod,
      headers: upstreamHeaders,
      cf: {
        cacheEverything: true,
        cacheKey: upstreamVideoUrl,
        cacheTtl: 86400
      }
    })

    const proxiedHeaders = new Headers(upstreamResponse.headers)
    proxiedHeaders.set('Accept-Ranges', 'bytes')
    const defaultCache = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400, immutable'
    proxiedHeaders.set('Cache-Control', proxiedHeaders.get('Cache-Control') || defaultCache)

    const cd = proxiedHeaders.get('Content-Disposition') || ''
    const filenameMatch = cd.match(/filename\*?=([^;]+)/i)
    const filenamePart = filenameMatch ? filenameMatch[1].trim() : 'video'
    proxiedHeaders.set('Content-Disposition', `inline; filename=${filenamePart}`)

    const fallbackMime = proxiedHeaders.get('Content-Type') || 'video/mp4'
    proxiedHeaders.set('Content-Type', fallbackMime)

    const body = request.method === 'HEAD' ? null : upstreamResponse.body

    return new Response(body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: proxiedHeaders
    })
  }

  const response = await fetch(request)
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return response

  const html = await response.text()
  const filenameMatch = html.match(/id="initial-state-files_sharing-filename" value="([^"]+)"/)
  if (!filenameMatch) return new Response(html, response)

  let filename = 'video.mp4'
  try {
    filename = JSON.parse(atob(filenameMatch[1]))
  } catch (e) {
    return new Response(html, response)
  }

  if (!filename.match(/\.(mp4|webm|mov)$/i)) return new Response(html, response)

  const extension = filename.split('.').pop().toLowerCase()
  const mimeByExtension = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }
  const videoMimeType = mimeByExtension[extension] || 'video/mp4'
  const videoUrl = proxiedVideoUrl

  let modifiedHtml = html
  modifiedHtml = modifiedHtml.replace(/<meta[^>]+property="og:type"[^>]+content="object"[^>]*>/gi, '')
  modifiedHtml = modifiedHtml.replace(/<meta[^>]+property="og:type"[^>]+content="video\.movie"[^>]*>/gi, '')
  modifiedHtml = modifiedHtml.replace(/<meta[^>]+property="og:video:[^"]*"[^>]*>/gi, '')
  modifiedHtml = modifiedHtml.replace(/<meta[^>]+name="twitter:(player|card)"[^>]*>/gi, '')

  const videoTags = `
    <meta property="og:type" content="video.movie">
    <meta property="og:video:url" content="${videoUrl}">
    <meta property="og:video:secure_url" content="${videoUrl}">
    <meta property="og:video:type" content="${videoMimeType}">
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
