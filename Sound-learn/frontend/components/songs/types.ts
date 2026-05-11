export interface SongMeta {
  id: string;
  title: string;
  artist: string;
}

export interface ReferencePitchFrame {
  time: number;
  midi_note: number;
  frequency: number;
}

export interface ReferencePitchResponse {
  song_id: string;
  title: string;
  frames: ReferencePitchFrame[];
}

export interface SongSelectorProps {
  onSelect: (song: SongMeta, frames: ReferencePitchFrame[]) => void;
}
