import { pageWindow } from '@/utils/pageWindow'
import type { GalleryTag } from '@/composables/useEhGalleryHost'

export type VoteState = 'up' | 'down' | null

export interface VoteServerResponse {
  error?: string
  tagpaneHtml?: string
  needsLogin?: boolean
  redirect?: string
}

export interface VoteOutcome {
  optimistic: VoteState
  promise: Promise<VoteServerResponse>
}

export interface VoteContext {
  apiuid: number
  apikey: string
  gid: number
  token: string
}

interface NativePageGlobals {
  apiuid?: number
  apikey?: string
}

/** /g/ 頁的投票憑證：gid / token 在網址上，apiuid / apikey 是頁面全域變數 */
export function nativeVoteContext(): VoteContext | null {
  const m = location.pathname.match(/^\/g\/(\d+)\/([a-f0-9]+)\/?$/)
  if (!m) return null

  const w = pageWindow<NativePageGlobals>()
  if (typeof w.apiuid !== 'number' || typeof w.apikey !== 'string') return null

  return {
    apiuid: w.apiuid,
    apikey: w.apikey,
    gid: Number(m[1]),
    token: m[2],
  }
}

function galleryApiEndpoint(): string {
  return location.hostname === 'exhentai.org'
    ? 'https://s.exhentai.org/api.php'
    : 'https://api.e-hentai.org/api.php'
}

interface RawApiResponse {
  error?: string
  tagpane?: string
  login?: string
  redirect?: string
}

async function callApiVote(ctx: VoteContext | null, tagsField: string, vote: 1 | -1): Promise<VoteServerResponse> {
  if (!ctx) {
    return { error: 'vote context unavailable (apiuid/apikey/url mismatch)' }
  }
  let res: Response
  try {
    res = await fetch(galleryApiEndpoint(), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'taggallery',
        apiuid: ctx.apiuid,
        apikey: ctx.apikey,
        gid: ctx.gid,
        token: ctx.token,
        tags: tagsField,
        vote,
      }),
    })
  } catch (e) {
    return { error: `network error: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!res.ok) {
    return { error: `HTTP ${res.status}` }
  }
  let body: RawApiResponse
  try {
    body = await res.json() as RawApiResponse
  } catch {
    return { error: 'invalid JSON response' }
  }
  if (body.login) return { needsLogin: true }

  const out: VoteServerResponse = {}
  if (body.error) out.error = body.error
  if (body.redirect) out.redirect = body.redirect
  if (body.tagpane) out.tagpaneHtml = body.tagpane
  return out
}

interface VoteAction {
  postValue: 1 | -1
  newState: VoteState
}

function computeAction(button: 'up' | 'down', current: VoteState): VoteAction {
  if (button === 'up') {
    if (current === 'up') return { postValue: -1, newState: null }
    if (current === 'down') return { postValue: 1, newState: null }
    return { postValue: 1, newState: 'up' }
  }
  if (current === 'down') return { postValue: 1, newState: null }
  if (current === 'up') return { postValue: -1, newState: null }
  return { postValue: -1, newState: 'down' }
}

export function vote(ctx: VoteContext | null, tag: GalleryTag, button: 'up' | 'down', current: VoteState): VoteOutcome {
  const { postValue, newState } = computeAction(button, current)
  return {
    optimistic: newState,
    promise: callApiVote(ctx, tag.nsRaw, postValue),
  }
}

export function batchVote(ctx: VoteContext | null, tags: GalleryTag[], voteValue: 1 | -1): Promise<VoteServerResponse> {
  const tagsField = tags.map(t => t.nsRaw).join(',')
  return callApiVote(ctx, tagsField, voteValue)
}
