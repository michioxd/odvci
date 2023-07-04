import { posix as pathPosix } from 'path'

import type { NextApiRequest, NextApiResponse } from 'next'
import axios, { AxiosResponseHeaders } from 'axios'
import Cors from 'cors'

import { driveApi, cacheControlHeader } from '../../../../config/api.config';
import { encodePath, getAccessToken, checkAuthRoute } from '.'

function b64DecodeUnicode(str: string) {
    // Going backwards: from bytestream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

// CORS middleware for raw links: https://nextjs.org/docs/api-routes/api-middlewares
export function runCorsMiddleware(req: NextApiRequest, res: NextApiResponse) {
    const cors = Cors({ methods: ['GET', 'HEAD'] })
    return new Promise((resolve, reject) => {
        cors(req, res, result => {
            if (result instanceof Error) {
                return reject(result)
            }

            return resolve(result)
        })
    })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const accessToken = await getAccessToken()
    if (!accessToken) {
        res.status(403).json({ error: 'No access token.', homepage: 'https://www.uniime.net' })
        return
    }

    // const { path = '/', odpt = '', proxy = false } = req.query

    const { requestMode = '', hash = '', odpt = '', proxy = false } = req.query

    if (requestMode !== 'fileAccess') {
        res.status(400).json({ error: 'Invalid Request Mode.', homepage: 'https://www.uniime.net' });
        return;
    }

    const path = b64DecodeUnicode(hash);

    // Sometimes the path parameter is defaulted to '[...path]' which we need to handle
    if (path === '[...path]') {
        res.status(400).json({ error: 'No hash specified.', homepage: 'https://www.uniime.net' })
        return
    }
    // If the path is not a valid path, return 400
    if (typeof path !== 'string') {
        res.status(400).json({ error: 'Hash query invalid.', homepage: 'https://www.uniime.net' })
        return
    }
    const cleanPath = pathPosix.resolve('/', pathPosix.normalize(path))

    // Handle protected routes authentication
    const odTokenHeader = (req.headers['od-protected-token'] as string) ?? odpt

    const { code, message } = await checkAuthRoute(cleanPath, accessToken, odTokenHeader)
    // Status code other than 200 means user has not authenticated yet
    if (code !== 200) {
        res.status(code).json({ error: message })
        return
    }
    // If message is empty, then the path is not protected.
    // Conversely, protected routes are not allowed to serve from cache.
    if (message !== '') {
        res.setHeader('Cache-Control', 'no-cache')
    }

    await runCorsMiddleware(req, res)
    try {
        // Handle response from OneDrive API
        const requestUrl = `${driveApi}/root${encodePath(cleanPath)}`
        const { data } = await axios.get(requestUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
                // OneDrive international version fails when only selecting the downloadUrl (what a stupid bug)
                select: 'id,size,@microsoft.graph.downloadUrl',
            },
        })

        if ('@microsoft.graph.downloadUrl' in data) {
            // Only proxy raw file content response for files up to 4MB
            if (proxy && 'size' in data && data['size'] < 4194304) {
                const { headers, data: stream } = await axios.get(data['@microsoft.graph.downloadUrl'] as string, {
                    responseType: 'stream',
                })
                headers['Cache-Control'] = cacheControlHeader
                // Send data stream as response
                res.writeHead(200, headers as AxiosResponseHeaders)
                stream.pipe(res)
            } else {
                res.redirect(data['@microsoft.graph.downloadUrl'])
            }
        } else {
            res.status(404).json({ error: 'Hash broken, try again!', homepage: 'https://www.uniime.net' })
        }
        return
    } catch (error: any) {
        res.status(error?.response?.status ?? 500).json({ error: error?.response?.data ?? 'Internal server error.' })
        return
    }
}
