# Product: Haunt Kit

Haunt Kit turns any phone into a motion, sound and touch controller for a web app. A player scans a QR code, taps one button, and the phone's tilt, shakes, mic loudness and taps reach the app. Nothing to install. Developers describe a new gesture in a Kiro spec file, and a Kiro hook writes the detector and its tests.

Hackathon: Kiroween 2026, **Skeleton Crew** category (one reusable template plus two distinct apps in separate folders).

## The two apps

- **Séance Party** (`apps/seance-party`): Halloween party game for 1 to 8 players on a big screen. Minigames: Ouija Planchette (everyone's tilt is averaged to steer one planchette), Hold Still or the Ghost Sees You, Banshee Scream-off. AI ghost bots for solo play.
- **Steady** (`apps/steady`): home physical-therapy rep counter on one phone. Counts reps aloud, measures range of motion in degrees, warns about tempo and range, and builds a printable report for the therapist.

## Users

- Developers who want phone controls in a web app.
- Friends at a party.
- People doing physical therapy at home.

## Judging criteria (equal weight)

Potential Impact, Technological Implementation, Design, Innovation, Presentation.

## Rules every change must follow

- Raw audio never leaves the phone. Only an RMS loudness number (0..1) is sent.
- Steady data stays on the device. No account, no server.
- Steady is not a medical device and gives no medical advice. Say so in the app.
- Every app must work for a judge testing alone or with no phone at all (AI bots + desktop simulator).
- Only original or license-free assets (fonts, sounds, images, music).

## Key dates

| Date                   | Milestone                   |
| ---------------------- | --------------------------- |
| Tue Nov 17             | Protocol freeze             |
| Sun Nov 22             | Playtest #1 on real iPhones |
| Sun Nov 29             | Feature freeze + filming    |
| Tue Dec 1              | Code freeze                 |
| Thu Dec 3, 12:00 pm PT | Team submits                |
| Fri Dec 4, 2:00 pm PT  | Hackathon deadline          |
