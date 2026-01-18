import React from 'react'
import VideoCall from './_components/video-call-ui';

interface VideoCallSearchParams {
    sessionId?: string | string[];
    token?: string | string[];
}

interface VideoCallPageProps {
    searchParams: Promise<VideoCallSearchParams>;
}

export default async function VideoCallPage({ searchParams }: VideoCallPageProps) {
    const resolvedParams = await searchParams;

    const rawSessionId = resolvedParams.sessionId;
    const rawToken = resolvedParams.token;

    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] ?? "" : rawSessionId ?? "";
    const token = Array.isArray(rawToken) ? rawToken[0] ?? "" : rawToken ?? "";

    return (
        <VideoCall sessionId={sessionId} token={token} />
    )
}
