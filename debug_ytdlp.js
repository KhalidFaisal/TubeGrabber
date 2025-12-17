const youtubedl = require('yt-dlp-exec');

async function testYtDlp() {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log('Testing yt-dlp for:', url);
    try {
        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            preferFreeFormats: true,
        });
        console.log('Title:', output.title);
        console.log('Duration:', output.duration);
        console.log('Formats found:', output.formats.length);

        // Check for high res
        const highRes = output.formats.find(f => f.height >= 1080);
        if (highRes) {
            console.log('Found 1080p+ format:', highRes.format_id, highRes.height);
        } else {
            console.log('No 1080p found (might be restricted or unavailable)');
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

testYtDlp();
