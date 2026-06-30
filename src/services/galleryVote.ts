import { unsafeWindow } from '$'
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

interface VoteContext {
  apiuid: number
  apikey: string
  gid: number
  token: string
}

interface NativePageGlobals {
  apiuid?: number
  apikey?: string
}

function getVoteContext(): VoteContext | null {
  const m = location.pathname.match(/^\/g\/(\d+)\/([a-f0-9]+)\/?$/)
  if (!m) return null

  const w = unsafeWindow as unknown as NativePageGlobals
  if (typeof w.apiuid !== 'number' || typeof w.apikey !== 'string') return null

  return {
    apiuid: w.apiuid,
    apikey: w.apikey,
    gid: Number(m[1]),
    token: m[2],
  }
}

interface RawApiResponse {
  error?: string
  tagpane?: string
  login?: string
  redirect?: string
}

async function callApiVote(tagsField: string, vote: 1 | -1): Promise<VoteServerResponse> {
  const ctx = getVoteContext()
  if (!ctx) {
    return { error: 'vote context unavailable (apiuid/apikey/url mismatch)' }
  }
  const apiHost = location.hostname === 'exhentai.org'
    ? 's.exhentai.org'
    : 'api.e-hentai.org'
  let res: Response
  try {
    res = await fetch(`https://${apiHost}/api.php`, {
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

export function vote(tag: GalleryTag, button: 'up' | 'down', current: VoteState): VoteOutcome {
  const { postValue, newState } = computeAction(button, current)
  return {
    optimistic: newState,
    promise: callApiVote(tag.nsRaw, postValue),
  }
}

export function batchVote(tags: GalleryTag[], voteValue: 1 | -1): Promise<VoteServerResponse> {
  const tagsField = tags.map(t => t.nsRaw).join(',')
  return callApiVote(tagsField, voteValue)
}
