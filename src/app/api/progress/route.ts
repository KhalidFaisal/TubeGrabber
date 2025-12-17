import { progressStore } from '@/lib/progressStore';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return new Response('Missing ID', { status: 400 });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'connected' })}\n\n`));

            const cleanup = progressStore.subscribe(id, (data) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                try {
                    controller.enqueue(encoder.encode(message));
                } catch (e) {
                    console.error('Error sending progress:', e);
                    cleanup();
                }
            });

            // Cleanup on client disconnect
            req.signal.addEventListener('abort', cleanup);
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
