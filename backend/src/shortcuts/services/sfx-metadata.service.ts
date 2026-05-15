import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SoundEffect } from '../../soundtrack/soundeffects/entities/sound-effect.entity';

/**
 * Service to extract metadata (especially duration) from audio files.
 * Supports common audio formats: MP3, WAV, OGG, FLAC, M4A.
 */
@Injectable()
export class SfxMetadataService {
  private readonly logger = new Logger(SfxMetadataService.name);
  private durationCache = new Map<string, { duration: number; timestamp: number }>();
  private readonly CACHE_TTL_MS = 3600000; // 1 hour

  constructor(
    @InjectRepository(SoundEffect)
    private soundEffectRepository: Repository<SoundEffect>,
  ) {}

  /**
   * Get the duration of a sound effect in milliseconds.
   * First tries to read from metadata, falls back to default if not available.
   */
  async getDurationMs(effectId: string): Promise<number> {
    // Check cache first
    const cached = this.durationCache.get(effectId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.duration;
    }

    try {
      const soundEffect = await this.soundEffectRepository.findOne({
        where: { id: effectId },
        select: ['id', 'data', 'mimeType', 'name'],
      });

      if (!soundEffect) {
        this.logger.warn(`Sound effect ${effectId} not found`);
        return 5000; // Default fallback
      }

      if (!soundEffect.data || soundEffect.data.length === 0) {
        this.logger.warn(`Sound effect ${effectId} has no data`);
        return 5000;
      }

      // Try to extract duration from audio data
      const duration = await this.extractDuration(soundEffect.data, soundEffect.mimeType);
      
      // Cache the result
      this.durationCache.set(effectId, { duration, timestamp: Date.now() });
      
      return duration;
    } catch (error) {
      this.logger.error(`Failed to get duration for ${effectId}: ${error}`);
      return 5000; // Default fallback
    }
  }

  /**
   * Estimate duration from audio buffer using simple heuristics.
   * This uses a fallback method that estimates based on file size.
   * For more accurate results, the music-metadata library can be integrated.
   */
  private async extractDuration(buffer: Buffer, mimeType: string): Promise<number> {
    // Use simple estimation based on file size and bitrate heuristics
    return this.estimateFromFileSize(buffer, mimeType);
  }

  /**
   * Estimate duration based on file size and typical bitrate.
   * Used as fallback when metadata extraction fails.
   * Assumes average bitrate of 128-256 kbps depending on format.
   */
  private estimateFromFileSize(buffer: Buffer, mimeType: string): number {
    // Typical bitrates for common formats (in kbps)
    const bitrates: Record<string, number> = {
      'audio/mpeg': 128, // MP3: 128 kbps average
      'audio/wav': 256, // WAV: uncompressed, ~256 kbps
      'audio/ogg': 96, // OGG: 96 kbps average
      'audio/flac': 180, // FLAC: ~180 kbps
      'audio/mp4': 128, // M4A: 128 kbps
      'audio/webm': 96, // WEBM: 96 kbps
    };

    const bitrate = bitrates[mimeType] || 128; // Default 128 kbps
    const bytes = buffer.length;
    const kilobytes = bytes / 1024;
    const durationSeconds = kilobytes / (bitrate / 8); // bitrate in KBps = bitrate kbps / 8
    const durationMs = Math.round(durationSeconds * 1000);

    // Clamp between 100ms and 120s to avoid absurd values
    return Math.max(100, Math.min(120000, durationMs));
  }

  /**
   * Clear cache (useful for testing or manual refresh).
   */
  clearCache(): void {
    this.durationCache.clear();
  }

  /**
   * Get cache statistics for debugging.
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.durationCache.size,
      entries: Array.from(this.durationCache.keys()),
    };
  }
}
