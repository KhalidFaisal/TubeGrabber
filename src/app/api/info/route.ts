import { NextResponse } from 'next/server';
import youtubedl, { create as createYtDlp } from 'yt-dlp-exec';

import path from 'path';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    // Basic validation
    if (!url || !url.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/)) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Explicitly resolve binary path to avoid "system cannot find path" issues
    const binaryPath = path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');

    // Create a factory function usage or just pass it if the library supports it?
    // yt-dlp-exec default export is a factory that creates the function, but simpler way:
    // We can't easily configure the default instance path without creating a factory.
    // Actually, create(binaryPath) is how we make a custom instance.

    // Changing import to use 'create'
    const isPlaylist = url.includes('list=') && !url.includes('list=LL') && !url.includes('list=WL');

    // Changing import to use 'create'
    const ytDlp = createYtDlp(binaryPath);

    const output = await ytDlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      flatPlaylist: isPlaylist // Only use flat-playlist if we suspect it's a playlist
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ytOutput = output as any;

    if (ytOutput._type === 'playlist') {
      return NextResponse.json({
        type: 'playlist',
        title: ytOutput.title,
        author: ytOutput.uploader,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entries: ytOutput.entries.map((entry: any) => ({
          id: entry.id,
          title: entry.title,
          url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
          duration: entry.duration
        }))
      });
    }

    // Map yt-dlp formats to our structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formats = ytOutput.formats.map((f: any) => ({
      itag: f.format_id, // yt-dlp uses format_id which might not be itag, but we use it as ID
      // Prefer "1080p" style label
      qualityLabel: f.height ? `${f.height}p` : (f.format_note || f.resolution || 'Unknown'),
      container: f.ext,
      hasAudio: f.acodec !== 'none',
      hasVideo: f.vcodec !== 'none',
      mimeType: `${f.ext}`, // Simplified
      contentLength: f.filesize
    }));

    const videoDetails = {
      type: 'video', // Explicit type
      title: ytOutput.title,
      description: ytOutput.description,
      thumbnails: ytOutput.thumbnails.map((t: any) => ({ url: t.url })),
      author: ytOutput.uploader,
      lengthSeconds: ytOutput.duration,
      formats: formats
    };

    return NextResponse.json(videoDetails);
  } catch (error) {
    console.error('Error fetching video info:', error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorMessage = (error as any)?.stderr || (error as any)?.message || 'Unknown error';
    console.error('Detailed stderr:', errorMessage);
    return NextResponse.json({ error: `Failed to fetch video info: ${errorMessage}` }, { status: 500 });
  }
}
