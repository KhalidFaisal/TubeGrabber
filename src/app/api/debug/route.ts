import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
    const cwd = process.cwd();
    const binaryPath = path.join(cwd, 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
    const exists = fs.existsSync(binaryPath);

    console.log('[DEBUG] CWD:', cwd);
    console.log('[DEBUG] Binary Path:', binaryPath);
    console.log('[DEBUG] Exists:', exists);

    return NextResponse.json({ cwd, binaryPath, exists });
}
