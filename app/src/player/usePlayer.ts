import { useEffect, useRef, useState } from 'react';

import { PlaybackController, PlayerSnapshot } from './PlaybackController';

const INITIAL: PlayerSnapshot = {
  playing: false,
  currentIndex: -1,
  loadedCount: 0,
  finished: false,
  buffering: false,
};

/** React binding around a single PlaybackController instance per mount. */
export function usePlayer(): { controller: PlaybackController; state: PlayerSnapshot } {
  const ref = useRef<PlaybackController>();
  if (!ref.current) ref.current = new PlaybackController();
  const [state, setState] = useState<PlayerSnapshot>(INITIAL);

  useEffect(() => {
    const controller = ref.current!;
    controller.onChange = setState;
    return () => {
      controller.destroy();
    };
  }, []);

  return { controller: ref.current!, state };
}
