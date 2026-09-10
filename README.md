# Rythm-spel

"Practical Assignment – ​​Rhythm Game

Build a simple rhythm game that allows the player to upload any song and automatically creates a playable level based on the music.

Requirements:

- The player must be able to upload or select a song.
- The game must automatically generate a level based on the music.
- Each playthrough should feel unique.
- There must be three difficulty levels: Easy, Medium, and Hard.
- The game should feature a simple scoring system and a clear results screen.
- It should be easy to launch and share so we can test it without hassle. A web-based game with a public demo link is preferred, though any technology stack is acceptable.
- Do not upload copyrighted music to the project repository; testers should use their own audio files.
- Create a Git repository and share it with us as soon as you begin.
- Make regular commits with clear messages so we can track progress—avoid submitting just a single commit once everything is finished.
- Include a README file explaining how to launch the game, how it works, and any known issues.
- You are free to use AI tools however you like. You should be prepared to explain key technical choices and design decisions.

The finished prototype must allow us to open the game, select a song, choose a difficulty level, play an automatically generated level, view the results, and restart with a new variation."

## Techstack

- **Language:** TypeScript
- **Bundler:** Vite Fast dev server
- **Router:** React-router
- **Rendering:** HTML5 Canvas (2D)
- **Audio:** Web Audio API
- **Analysis:** A beat-detection library -- web-audio-beat-detector, @villium/echo-beat or rhy-game
- **Deploy:** Cloudflare Pages/Workers
