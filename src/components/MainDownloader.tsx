'use client';

import { useState, useEffect } from 'react';
import { Search, Download, Youtube, Loader2, Music, Video, AlertCircle, Clock, Trash2, List, Check, CheckSquare, Square, FolderArchive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HistoryItem {
    url: string;
    title: string;
    thumbnail: string;
    timestamp: number;
    duration: number;
}

export default function MainDownloader() {
    const [url, setUrl] = useState('');
    const [loadedUrl, setLoadedUrl] = useState('');
    const [loading, setLoading] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [videoInfo, setVideoInfo] = useState<any>(null);
    const [error, setError] = useState('');
    const [history, setHistory] = useState<HistoryItem[]>([]);

    // Multi-select state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isBatchDownloading, setIsBatchDownloading] = useState(false);
    const [isZipping, setIsZipping] = useState(false);
    const [batchFormat, setBatchFormat] = useState<'video' | 'audio'>('video');
    const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map());

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('yt_history');
            if (saved) {
                try {
                    setHistory(JSON.parse(saved));
                } catch (e) {
                    console.error('Failed to parse history', e);
                }
            }
        }
    }, []);

    // Clear selection when new video/playlist is loaded
    useEffect(() => {
        setSelectedItems(new Set());
        setBatchFormat('video'); // Reset to video default
        setProgressMap(new Map());
    }, [videoInfo]);

    const addToHistory = (info: any) => {
        if (!info || info.type === 'playlist') return; // Don't add full playlist to recent downloads (maybe later)

        const thumbnail = info.thumbnails ? info.thumbnails[info.thumbnails.length - 1].url : '';

        const newItem: HistoryItem = {
            url: loadedUrl || url,
            title: info.title,
            thumbnail: thumbnail,
            timestamp: Date.now(),
            duration: info.lengthSeconds
        };

        setHistory(prev => {
            const filtered = prev.filter(h => h.url !== newItem.url);
            const updated = [newItem, ...filtered].slice(0, 10);
            localStorage.setItem('yt_history', JSON.stringify(updated));
            return updated;
        });
    };

    const removeFromHistory = (targetUrl: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setHistory(prev => {
            const updated = prev.filter(h => h.url !== targetUrl);
            localStorage.setItem('yt_history', JSON.stringify(updated));
            return updated;
        });
    };

    const restoreFromHistory = (item: HistoryItem) => {
        setUrl(item.url);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fetchInfo(item.url);
    };

    const fetchInfo = async (urlOverride?: string) => {
        const targetUrl = urlOverride || url;
        if (!targetUrl) return;
        setLoading(true);
        setError('');
        setVideoInfo(null);

        try {
            if (!targetUrl.includes('youtube.com/') && !targetUrl.includes('youtu.be/')) {
                throw new Error('Please enter a valid YouTube URL');
            }

            const res = await fetch('/api/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: targetUrl })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to fetch video info');
            setVideoInfo(data);
            setLoadedUrl(targetUrl);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (itag: number | string | null, ext: string = 'mp4', title: string | null = null) => {
        if (videoInfo && videoInfo.type !== 'playlist') {
            addToHistory(videoInfo);
        }

        const titleParam = title ? `&title=${encodeURIComponent(title)}` : '';
        const itagParam = itag ? `&itag=${itag}` : '';
        const downloadUrl = loadedUrl || url; // Note: for playlist items, we might want to download *that* specific video.

        window.location.href = `/api/download?url=${encodeURIComponent(downloadUrl)}${itagParam}&ext=${ext}${titleParam}`;
    };

    const loadPlaylistItem = (itemUrl: string) => {
        setUrl(itemUrl);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fetchInfo(itemUrl);
    };

    // Multi-select handlers
    const toggleSelection = (itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (!videoInfo || videoInfo.type !== 'playlist') return;

        if (selectedItems.size === videoInfo.entries.length) {
            setSelectedItems(new Set());
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allIds = videoInfo.entries.map((e: any) => e.url); // Using URL as unique key for selection
            setSelectedItems(new Set(allIds));
        }
    };

    const handleBatchDownload = async () => {
        if (selectedItems.size === 0) return;

        setIsBatchDownloading(true);
        const uniqueEntries = Array.from(selectedItems);
        const ext = batchFormat === 'audio' ? 'mp3' : 'mp4';

        // Process sequentially with a small delay to prevent browser blocking
        for (const itemUrl of uniqueEntries) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const entry = videoInfo.entries.find((e: any) => e.url === itemUrl);
            const title = entry ? entry.title : null;
            const titleParam = title ? `&title=${encodeURIComponent(title)}` : '';

            // Generate unique ID for progress tracking
            const downloadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Start EventSource for progress
            const eventSource = new EventSource(`/api/progress?id=${downloadId}`);

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.progress !== undefined) {
                    setProgressMap(prev => new Map(prev).set(itemUrl, data.progress));
                }
                if (data.status === 'completed' || data.error) {
                    eventSource.close();
                }
            };

            // Trigger download
            const downloadUrl = `/api/download?url=${encodeURIComponent(itemUrl)}&ext=${ext}${titleParam}&id=${downloadId}`;

            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = downloadUrl;
            document.body.appendChild(iframe);

            // Cleanup iframe after a minute
            setTimeout(() => {
                document.body.removeChild(iframe);
                eventSource.close();
            }, 60000);

            // Wait 1.5s between triggers
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        setIsBatchDownloading(false);
    };

    const handleZipDownload = async () => {
        if (selectedItems.size === 0) return;
        setIsZipping(true);

        try {
            const uniqueEntries = Array.from(selectedItems).map(url => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const entry = videoInfo.entries.find((e: any) => e.url === url);
                return { url, title: entry?.title || 'Video' };
            });

            const res = await fetch('/api/zip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries: uniqueEntries, format: batchFormat })
            });

            if (!res.ok) throw new Error('Zip generation failed');

            // Handle blob download
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `playlist_download_${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (err) {
            console.error('Zip error', err);
            setError('Failed to create ZIP archive');
        } finally {
            setIsZipping(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4 space-y-8 pb-24">
            <div className="text-center space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center space-x-2"
                >
                    <Youtube className="w-12 h-12 text-primary" />
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-primary/80 glow-text">
                        TubeGrabber
                    </h1>
                </motion.div>

                <p className="text-zinc-400 text-lg">Download your favorite videos in seconds.</p>
                <div className="text-sm text-zinc-500 font-mono">v1.3.1 - Bug Fixes</div>

                <div className="relative max-w-2xl mx-auto group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative flex items-center bg-zinc-900 rounded-xl p-2 ring-1 ring-white/10 shadow-2xl">
                        <input
                            type="text"
                            placeholder="Paste YouTube URL here..."
                            className="flex-1 bg-transparent border-none outline-none text-white px-4 py-2 placeholder:text-zinc-600"
                            value={url}
                            onChange={(e) => {
                                const val = e.target.value;
                                setUrl(val);
                                if (val.includes('youtube.com/') || val.includes('youtu.be/')) {
                                    if (val.length > 15) {
                                        fetchInfo(val);
                                    }
                                }
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
                        />
                        <button
                            onClick={() => fetchInfo()}
                            disabled={loading || !url}
                            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            <span>Fetch</span>
                        </button>
                    </div>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-lg inline-flex items-center"
                    >
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {error}
                    </motion.div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {videoInfo && videoInfo.type === 'playlist' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass rounded-2xl overflow-hidden p-6 relative"
                    >
                        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                            <div className="flex items-center space-x-3">
                                <List className="w-6 h-6 text-primary" />
                                <div>
                                    <h2 className="text-2xl font-bold">{videoInfo.title}</h2>
                                    <p className="text-zinc-400">Playlist by {videoInfo.author} • {videoInfo.entries.length} videos</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center space-x-1 bg-zinc-800/50 rounded-lg p-1 border border-white/5">
                                    <button
                                        onClick={() => setBatchFormat('video')}
                                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center space-x-2 ${batchFormat === 'video' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        <Video className="w-4 h-4" />
                                        <span className="hidden sm:inline">Video</span>
                                    </button>
                                    <button
                                        onClick={() => setBatchFormat('audio')}
                                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center space-x-2 ${batchFormat === 'audio' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                    >
                                        <Music className="w-4 h-4" />
                                        <span className="hidden sm:inline">Audio</span>
                                    </button>
                                </div>

                                <button
                                    onClick={toggleSelectAll}
                                    className="flex items-center space-x-2 px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-lg transition-colors border border-white/5"
                                >
                                    {selectedItems.size === videoInfo.entries.length && videoInfo.entries.length > 0 ? (
                                        <CheckSquare className="w-5 h-5 text-primary" />
                                    ) : (
                                        <Square className="w-5 h-5 text-zinc-400" />
                                    )}
                                    <span>{selectedItems.size === videoInfo.entries.length ? 'Deselect All' : 'Select All'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {videoInfo.entries.map((entry: any, i: number) => {
                                const isSelected = selectedItems.has(entry.url);
                                const progress = progressMap.get(entry.url);

                                return (
                                    <div
                                        key={`${entry.id || 'entry'}-${i}`}
                                        className={`flex items-center justify-between p-4 rounded-lg transition-all group cursor-pointer border relative overflow-hidden ${isSelected ? 'bg-primary/10 border-primary/30' : 'bg-zinc-800/30 border-transparent hover:bg-zinc-800/50'}`}
                                        onClick={() => toggleSelection(entry.url)}
                                    >
                                        {/* Progress Bar Background */}
                                        {progress !== undefined && (
                                            <div
                                                className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-300"
                                                style={{ width: `${progress}%` }}
                                            />
                                        )}

                                        <div className="flex items-center space-x-4 min-w-0 flex-1 relative z-10">
                                            <div
                                                className={`w-6 h-6 rounded flex items-center justify-center transition-colors border ${isSelected ? 'bg-primary border-primary' : 'border-zinc-600 group-hover:border-zinc-500'}`}
                                            >
                                                {isSelected && <Check className="w-4 h-4 text-white" />}
                                                {!isSelected && <div className="text-zinc-500 font-mono text-xs opacity-0 group-hover:opacity-0">{i + 1}</div>}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className={`font-medium line-clamp-1 transition-colors ${isSelected ? 'text-primary' : 'text-white'}`}>{entry.title}</div>
                                                <div className="text-xs text-zinc-500 flex items-center space-x-2">
                                                    <span>{entry.duration ? new Date(entry.duration * 1000).toISOString().substr(11, 8) : 'Unknown duration'} • {i + 1}</span>
                                                    {progress !== undefined && (
                                                        <span className="text-green-400 font-mono bg-green-500/10 px-1.5 rounded">{progress.toFixed(1)}%</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2 ml-4 relative z-10">
                                            {isSelected && (
                                                <span className="text-xs font-medium text-primary px-2 py-0.5 bg-primary/10 rounded">
                                                    {batchFormat === 'audio' ? 'MP3' : 'Video'}
                                                </span>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    loadPlaylistItem(entry.url);
                                                }}
                                                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                                            >
                                                Details
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {videoInfo && videoInfo.type !== 'playlist' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass rounded-2xl overflow-hidden"
                    >
                        <div className="grid md:grid-cols-5 gap-0 md:gap-8">
                            <div className="md:col-span-2 relative aspect-video md:aspect-auto">
                                <img
                                    src={videoInfo.thumbnails[videoInfo.thumbnails.length - 1].url}
                                    alt={videoInfo.title}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                                    {new Date(videoInfo.lengthSeconds * 1000).toISOString().substr(11, 8)}
                                </div>
                            </div>

                            <div className="md:col-span-3 p-6 flex flex-col justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold line-clamp-2 mb-2">{videoInfo.title}</h2>
                                    <p className="text-zinc-400 mb-4 flex items-center">
                                        <span className="bg-zinc-800 px-2 py-0.5 rounded text-sm mr-2">Author</span>
                                        {videoInfo.author}
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Download Options</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {videoInfo.formats
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                .filter((f: any) => f.hasVideo)
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                .filter((f: any, index: number, self: any[]) =>
                                                    index === self.findIndex((t) => t.qualityLabel === f.qualityLabel)
                                                )
                                                .slice(0, 8)
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                .map((format: any, i: number) => (
                                                    <button
                                                        key={`${format.itag}-${i}`}
                                                        onClick={() => handleDownload(format.itag, format.container, videoInfo.title)}
                                                        className="flex items-center justify-between bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 p-3 rounded-lg transition-all group"
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            <div className="bg-zinc-800 p-2 rounded-lg group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                                                <Video className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-left">
                                                                <div className="font-medium">{format.qualityLabel || 'Standard'}</div>
                                                                <div className="text-xs text-zinc-500">
                                                                    {format.hasAudio ? format.container : `${format.container} (Merged)`}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Download className="w-4 h-4 text-zinc-500 group-hover:text-primary" />
                                                    </button>
                                                ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Audio & Tools</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <button
                                                onClick={() => handleDownload(null, 'mp3', videoInfo.title)}
                                                className="flex items-center justify-between bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 p-3 rounded-lg transition-all group"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <div className="bg-purple-600 p-2 rounded-lg text-white">
                                                        <Music className="w-5 h-5" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-medium">Convert to MP3</div>
                                                        <div className="text-xs text-zinc-400">Universal Audio</div>
                                                    </div>
                                                </div>
                                                <Download className="w-4 h-4 text-purple-400" />
                                            </button>

                                            {videoInfo.formats
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                .filter((f: any) => !f.hasVideo && f.hasAudio)
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                .filter((f: any, index: number, self: any[]) =>
                                                    index === self.findIndex((t) => t.contentLength === f.contentLength)
                                                )
                                                .slice(0, 3)
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                .map((format: any, i: number) => (
                                                    <button
                                                        key={`${format.itag}-${i}`}
                                                        onClick={() => handleDownload(format.itag, format.container, videoInfo.title)}
                                                        className="flex items-center justify-between bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 p-3 rounded-lg transition-all group"
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            <div className="bg-zinc-800 p-2 rounded-lg group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                                                <Music className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-left">
                                                                <div className="font-medium">Audio ({format.container})</div>
                                                                <div className="text-xs text-zinc-500">
                                                                    Original
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Download className="w-4 h-4 text-zinc-500 group-hover:text-primary" />
                                                    </button>
                                                ))}
                                        </div>
                                    </div>

                                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg flex items-start space-x-3">
                                        <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                                        <p className="text-sm text-blue-200">
                                            High-quality videos (1080p+) will be automatically merged. MP3 conversion may take extra time.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Batch Download Floating Action Buttons */}
            <AnimatePresence>
                {selectedItems.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-4"
                    >
                        <button
                            onClick={handleBatchDownload}
                            disabled={isBatchDownloading || isZipping}
                            className="bg-primary text-white shadow-lg shadow-primary/30 rounded-full px-6 py-4 font-bold text-lg flex items-center space-x-3 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-wait"
                        >
                            {isBatchDownloading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <Download className="w-6 h-6" />
                            )}
                            <div className="flex flex-col items-start">
                                <span className="leading-tight">Download {selectedItems.size} Files</span>
                            </div>
                        </button>

                        <button
                            onClick={handleZipDownload}
                            disabled={isBatchDownloading || isZipping}
                            className="bg-zinc-800 text-white shadow-lg shadow-black/30 rounded-full px-6 py-4 font-bold text-lg flex items-center space-x-3 hover:bg-zinc-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-wait ring-1 ring-white/10"
                        >
                            {isZipping ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <FolderArchive className="w-6 h-6 text-yellow-400" />
                            )}
                            <div className="flex flex-col items-start">
                                <span className="leading-tight">Save as ZIP</span>
                            </div>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {history.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="glass rounded-2xl p-6 mt-8"
                >
                    <div className="flex items-center space-x-2 mb-6 text-zinc-400">
                        <Clock className="w-5 h-5" />
                        <h3 className="font-semibold uppercase tracking-wider text-sm">Recent Downloads</h3>
                    </div>

                    <div className="space-y-3">
                        {history.map((item, i) => (
                            <div key={i} className="flex items-center justify-between bg-zinc-800/30 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group cursor-pointer" onClick={() => restoreFromHistory(item)}>
                                <div className="flex items-center space-x-4 flex-1 min-w-0">
                                    <img src={item.thumbnail} alt={item.title} className="w-24 h-auto aspect-video object-cover rounded" />
                                    <div className="min-w-0">
                                        <div className="font-medium text-white truncate text-lg pr-4">{item.title}</div>
                                        <div className="text-xs text-zinc-500 flex items-center space-x-2">
                                            <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span>{new Date(item.duration * 1000).toISOString().substr(11, 8)}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => removeFromHistory(item.url, e)}
                                    className="p-3 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
