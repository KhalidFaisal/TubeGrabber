import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { progressStore } from '@/lib/progressStore';

// Helper to sanitize filename
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sanitizeFilename(name: string) {
    return name.replace(/[^\w\s-]/gi, '_');
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const url = searchParams.get('url');
        const itag = searchParams.get('itag');
        const ext = searchParams.get('ext') || 'mp4';
        const titleParam = searchParams.get('title');
        const id = searchParams.get('id'); // Download ID for progress tracking

        console.log(`Download Request - itag: ${itag}, ext: ${ext}, url: ${url}, title: ${titleParam}, id: ${id}`);

        if (!url || !url.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/)) {
            return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
        }

        // Use provided title or fallback to timestamp
        const safeTitle = titleParam ? sanitizeFilename(titleParam) : `video_${Date.now()}`;

        const headers = new Headers();

        // Use the requested extension for the filename
        headers.set('Content-Disposition', `attachment; filename="${safeTitle}.${ext}"`);

        // Map common extensions to MIME types
        let mimeType = 'video/mp4';
        if (ext === 'm4a') mimeType = 'audio/mp4';
        else if (ext === 'mp3') mimeType = 'audio/mpeg';
        else if (ext === 'webm') mimeType = 'video/webm';

        headers.set('Content-Type', mimeType);

        // Explicit binary properties
        const cwd = process.cwd();
        const binaryPath = path.join(cwd, 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
        const ffmpegBinary = path.join(cwd, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');

        // Base args
        const args = [
            url,
            '--output', '-',
            '--no-warnings',
            '--no-check-certificates',
            '--prefer-free-formats',
            '--ffmpeg-location', ffmpegBinary,
            '--progress', // Ensure progress is output
            '--newline'   // Ensure stable line-based output
        ];

        // Format selection
        if (itag && itag !== 'null') {
            args.push('--format', itag);
            if (ext === 'mp3') {
                args.push('--extract-audio', '--audio-format', 'mp3');
            }
        } else {
            if (ext === 'mp3') {
                args.push('--format', 'bestaudio/best');
                args.push('--extract-audio', '--audio-format', 'mp3');
            } else {
                args.push('--format', 'bestvideo+bestaudio/best');
                args.push('--merge-output-format', 'mp4');
            }
        }

        console.log('Spawning:', binaryPath, args.join(' '));

        const child = spawn(binaryPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            cwd: cwd
        });

        // Create a ReadableStream from the stdout
        const stream = new ReadableStream({
            start(controller) {
                if (!child.stdout) return;

                child.stdout.on('data', (chunk: Buffer) => {
                    try {
                        controller.enqueue(chunk);
                    } catch (e) {
                        // Controller usage error
                    }
                });

                child.stdout.on('end', () => {
                    try {
                        controller.close();
                        if (id) progressStore.update(id, { progress: 100, status: 'completed' });
                    } catch (e) {
                        // Already closed
                    }
                });

                child.stdout.on('error', (err: Error) => {
                    console.error('Stream error:', err);
                    try {
                        controller.error(err);
                        if (id) progressStore.update(id, { error: err.message });
                    } catch (e) {
                        // closed
                    }
                });

                // Robust stderr parsing with buffering
                if (child.stderr) {
                    let stderrBuffer = '';
                    child.stderr.on('data', (data: Buffer) => {
                        const chunk = data.toString();
                        stderrBuffer += chunk;

                        const lines = stderrBuffer.split('\n');
                        // Process all complete lines
                        for (let i = 0; i < lines.length - 1; i++) {
                            const line = lines[i];
                            // Parse progress
                            // Sample: [download]  45.0% of ...
                            const match = line.match(/\[download\]\s+(\d+\.?\d*)%/);
                            if (match && id) {
                                const percent = parseFloat(match[1]);
                                // Only update for significant changes or throttle? 
                                // For now, just send it. SSE can handle it.
                                progressStore.update(id, { progress: percent, status: 'downloading' });
                            }
                        }
                        // Keep the last incomplete line
                        stderrBuffer = lines[lines.length - 1];
                    });
                }
            },
            cancel() {
                child.kill();
            }
        });

        return new NextResponse(stream, { headers });

    } catch (error) {
        console.error('Error downloading video:', error);
        return NextResponse.json({ error: 'Failed to download video' }, { status: 500 });
    }
}
