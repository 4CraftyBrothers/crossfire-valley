import { SPEAKERS, type StoryLine } from '../campaign/story';

/** A short exchange: portrait badge, speaker, line. Built with DOM text, never innerHTML. */
export function renderStory(lines: StoryLine[]): HTMLElement {
  const box = document.createElement('div');
  box.className = 'story';
  for (const line of lines) {
    const s = SPEAKERS[line.who];
    const row = document.createElement('div');
    row.className = `story-line side-${s.side}`;
    const face = document.createElement('span');
    face.className = 'portrait';
    face.textContent = s.initials;
    face.setAttribute('aria-hidden', 'true');
    const body = document.createElement('div');
    const who = document.createElement('b');
    who.textContent = s.name;
    const text = document.createElement('p');
    text.textContent = line.text;
    body.append(who, text);
    row.append(face, body);
    box.append(row);
  }
  return box;
}
