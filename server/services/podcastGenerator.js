// server/services/podcastGenerator.js
const { promises: fs } = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const fetch = require('node-fetch');

const execAsync = promisify(exec);

const AUDIO_DIR = path.join(__dirname, '..', 'public', 'podcasts');
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_MALE_VOICE = 'pNInz6obpgDQGcFmaJgB';
const ELEVENLABS_FEMALE_VOICE = 'EXAVITQu4vr4xnSDxMaL';

const createAudioDir = async () => {
    try { await fs.mkdir(AUDIO_DIR, { recursive: true }); } catch (error) { console.error('Failed to create audio directory:', error); throw error; }
};

async function generateTTSWithElevenLabs(text, voiceId, outputPath) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const body = {
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.7, style: 0.5, use_speaker_boost: true }
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify(body)
    });
    if (!response.ok) { throw new Error(`ElevenLabs TTS failed: ${response.status} ${response.statusText}`); }
    const buffer = await response.buffer();
    await fs.writeFile(outputPath, buffer);
}

const generatePodcastAudio = async (podcastScript, filename) => {
    try {
        if (!podcastScript || !Array.isArray(podcastScript)) { throw new Error('Podcast script array is required'); }
        if (!ELEVENLABS_API_KEY) { console.warn('ElevenLabs API key not set. Skipping audio generation.'); return null; }
        await createAudioDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
        const outputPath = path.join(AUDIO_DIR, `${safeFilename}_podcast_${timestamp}.mp3`);
        console.log(`Generating podcast audio with ${podcastScript.length} segments using ElevenLabs...`);
        const tempDir = path.join(AUDIO_DIR, 'temp');
        await fs.mkdir(tempDir, { recursive: true });
        const segmentFiles = [];
        for (let i = 0; i < podcastScript.length; i++) {
            const segment = podcastScript[i];
            const text = segment.text;
            let speaker = segment.speaker || 'male';
            let voiceId = ELEVENLABS_MALE_VOICE;
            if (speaker.toLowerCase().includes('female') || speaker.toLowerCase().includes('host b')) {
                voiceId = ELEVENLABS_FEMALE_VOICE;
            }
            const segmentFile = path.join(tempDir, `segment_${i}.mp3`);
            await generateTTSWithElevenLabs(text, voiceId, segmentFile);
            segmentFiles.push(segmentFile);
        }
        console.log(`Generated ${segmentFiles.length} segments, combining into final podcast with FFmpeg...`);
        const fileList = path.join(tempDir, 'filelist.txt');
        const fileListContent = segmentFiles.map(file => `file '${file}'`).join('\n');
        await fs.writeFile(fileList, fileListContent);
        const combineCommand = `ffmpeg -f concat -safe 0 -i "${fileList}" -c copy "${outputPath}" -y`;
        await execAsync(combineCommand);
        await Promise.allSettled([
            ...segmentFiles.map(file => fs.unlink(file)),
            fs.unlink(fileList),
            fs.rm(tempDir, { recursive: true, force: true })
        ]);
        const stats = await fs.stat(outputPath);
        if (stats.size === 0) { throw new Error('Generated audio file is empty (0 bytes)'); }
        console.log(`✅ Podcast generated: ${path.basename(outputPath)} (${stats.size} bytes)`);
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:5007';
        return `${baseUrl}/podcasts/${path.basename(outputPath)}`;
    } catch (error) {
        console.error('Error in generatePodcastAudio:', error);
        throw new Error(`Audio generation failed: ${error.message}`);
    }
};

module.exports = { generatePodcastAudio };