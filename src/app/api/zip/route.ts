import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import archiver from 'archiver';
import { PassThrough } from 'stream';

// Helper to sanitize filename
function sanitizeFilename(name: string) {
    return name.replace(/[^\w\s-]/gi, '_');
}

export const maxDuration = 300; // 5 minutes max for serverless, but infinite for local

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { entries, format } = body; // entries: { url: string, title: string }[]

        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return NextResponse.json({ error: 'No entries provided' }, { status: 400 });
        }

        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        const stream = new PassThrough();
        archive.pipe(stream);

        // Process in background (streaming response)
        const cwd = process.cwd();
        const binaryPath = path.join(cwd, 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
        const ffmpegBinary = path.join(cwd, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');

        // Start processing logic without blocking the initial response return
        // We use a self-executing async function to handle the queuing
        (async () => {
            try {
                for (const entry of entries) {
                    const safeTitle = sanitizeFilename(entry.title || `video_${Date.now()}`);
                    const ext = format === 'audio' ? 'mp3' : 'mp4';
                    const filename = `${safeTitle}.${ext}`;

                    const args = [
                        entry.url,
                        '--output', '-',
                        '--no-warnings',
                        '--no-check-certificates',
                        '--prefer-free-formats',
                        '--ffmpeg-location', ffmpegBinary
                    ];

                    if (format === 'audio') {
                        args.push('--format', 'bestaudio/best');
                        args.push('--extract-audio', '--audio-format', 'mp3');
                    } else {
                        args.push('--format', 'bestvideo+bestaudio/best');
                        args.push('--merge-output-format', 'mp4');
                    }

                    console.log(`Zipping: ${filename}`);

                    const child = spawn(binaryPath, args, {
                        stdio: ['ignore', 'pipe', 'ignore'], // Ignore stderr to avoid clutter, or log it ?
                        windowsHide: true,
                        cwd: cwd
                    });

                    if (child.stdout) {
                        archive.append(child.stdout, { name: filename });

                        // Wait for this download to finish before starting the next
                        // This prevents spawning 100 processes at once
                        await new Promise<void>((resolve, reject) => {
                            child.on('close', (code) => {
                                if (code === 0) resolve();
                                else {
                                    console.error(`Download failed for ${filename} with code ${code}`);
                                    // We resolve anyway to continue zipping other files
                                    resolve();
                                }
                            });
                            child.on('error', (err) => {
                                console.error(`Error spawning for ${filename}:`, err);
                                resolve();
                            });
                        });
                    }
                }

                await archive.finalize();
            } catch (err) {
                console.error('Archive generation error:', err);
                archive.abort();
            }
        })();

        // Return the reading end of the PassThrough stream
        // Web ReadableStream needed for NextResponse
        const readableWebStream = new ReadableStream({
            start(controller) {
                stream.on('data', (chunk) => controller.enqueue(chunk));
                stream.on('end', () => controller.close());
                stream.on('error', (err) => controller.error(err));
            }
        });

        return new NextResponse(readableWebStream, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="playlist_download_${Date.now()}.zip"`
            }
        });

    } catch (error) {
        console.error('Error in zip route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
