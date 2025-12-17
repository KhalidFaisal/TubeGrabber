# TubeGrabber

A modern, high-performance YouTube downloader built with Next.js, allowing users to download videos, audio, and entire playlists with ease.

## Features

- **Single Video Download**: Fetch and download individual videos in various qualities (1080p, 720p, etc.).
- **Playlist Support**: Paste a playlist URL to view and select multiple videos.
- **Batch Downloading**: Select multiple items from a playlist and download them sequentially.
- **Global Format Selection**: Choose between Video (MP4) or Audio (MP3) for all batch items.
- **Format Conversion**: Automatic conversion to MP3 for audio lovers.
- **Real-Time Progress Tracking**: Watch the progress of your downloads in real-time with visual progress bars.
- **ZIP Export**: Download multiple selected files as a single ZIP archive.
- **Download History**: Keep track of your recent downloads (locally stored).

## Tech Stack

- **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + Framer Motion for animations.
- **Backend Processing**: 
  - `yt-dlp-exec`: For robust video extraction.
  - `ffmpeg-static`: For format merging and conversion.
  - `archiver`: For generating ZIP files.
  - `EventSource` (SSE): For real-time progress updates.

## Getting Started

### Prerequisites

- Node.js 18+ installed.
- FFmpeg (handled automatically by `ffmpeg-static` in most cases, but system install recommended for production).

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/KhalidFaisal/TubeGrabber.git
    cd TubeGrabber
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1.  **Paste & Fetch**: Paste a YouTube video or playlist URL into the input box and hit "Fetch".
2.  **Select**: For playlists, use the checkboxes to select the videos you want.
3.  **Choose Format**: Toggle between "Video" and "Audio" modes for batch actions.
4.  **Download**:
    - Click **"Download Selected"** to download files individually.
    - Click **"Save as ZIP"** to bundle them into one archive.

## License

This project is for educational purposes only. Please respect YouTube's Terms of Service and copyright laws.
