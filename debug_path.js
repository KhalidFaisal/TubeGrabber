const path = require('path');
const fs = require('fs');

console.log('Current Working Directory:', process.cwd());
console.log('__dirname:', __dirname);

const explicitPath = path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
console.log('Constructed Path:', explicitPath);
console.log('Exists?', fs.existsSync(explicitPath));

// Also check relative lookup
try {
    const resolvedPath = require.resolve('yt-dlp-exec');
    console.log('yt-dlp-exec resolved to:', resolvedPath);
} catch (e) {
    console.log('Could not resolve yt-dlp-exec');
}

const ffmpegPath = require('ffmpeg-static');
console.log('FFmpeg Path:', ffmpegPath);
console.log('FFmpeg Exists?', fs.existsSync(ffmpegPath));
