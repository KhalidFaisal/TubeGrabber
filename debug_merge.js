const ytdl = require('@distube/ytdl-core');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');

async function testMerge() {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log('Fetching info for:', url);

    try {
        const info = await ytdl.getInfo(url);

        const videoFormat = info.formats.find(f => f.hasVideo && !f.hasAudio);
        if (!videoFormat) {
            console.log('No video-only format found.');
            return;
        }
        console.log(`Selected video: ${videoFormat.qualityLabel}`);

        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
        console.log(`Selected audio: ${audioFormat.itag}`);

        const videoStream = ytdl(url, { quality: videoFormat.itag });
        const audioStream = ytdl(url, { quality: audioFormat.itag });

        console.log('Spawning FFmpeg...');

        // Spawn ffmpeg with extra pipes: pipe:3 for video, pipe:4 for audio
        const ffmpegProcess = spawn(ffmpegPath, [
            '-loglevel', '8', '-hide_banner',
            '-i', 'pipe:3',
            '-i', 'pipe:4',
            '-map', '0:v',
            '-map', '1:a',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-f', 'mp4',
            '-movflags', 'frag_keyframe+empty_moov',
            'pipe:1' // Output to stdout
        ], {
            windowsHide: true,
            stdio: [
                'inherit', 'pipe', 'inherit', // stdin, stdout, stderr
                'pipe', 'pipe' // pipe:3 (video), pipe:4 (audio)
            ]
        });

        // Pipe streams to ffmpeg inputs
        videoStream.pipe(ffmpegProcess.stdio[3]);
        audioStream.pipe(ffmpegProcess.stdio[4]);

        const output = fs.createWriteStream('test_spawn_merge.mp4');
        ffmpegProcess.stdout.pipe(output);

        ffmpegProcess.on('exit', (code) => {
            console.log(`FFmpeg process exited with code ${code}`);
        });

    } catch (err) {
        console.error('Error:', err);
    }
}

testMerge();
