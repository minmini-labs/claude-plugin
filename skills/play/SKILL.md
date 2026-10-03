---
name: play
description: Play Imposter with the user against an AI crew you play, using the minmini tools. Use when the user wants a game, a break, or says "play Imposter".
---

# Play Imposter against an AI crew

The minmini tools (`imposter_solo_start`, `imposter_solo_ai`, `imposter_solo_play`, `imposter_solo_my_card`) run a game of Imposter. The user is one player. You play every other player. This terminal has no widget, so you carry the user's side of the game in the chat.

1. Call `imposter_solo_start` (players 4, rounds 2 unless the user asks otherwise). Its result lists each AI player's private card and says what to do next. Keep those private: never say who the imposter is or what the word is until the game is over.
2. Call `imposter_solo_my_card` once and tell the user their card in one line: either "The word is X" or "You are the imposter" with their hint.
3. Follow the NEXT line in every tool result. Make every consecutive AI player's move in ONE `imposter_solo_ai` call (a `moves` array, in turn order, stopping where the user's turn comes). Give about half the moves a short in-character `say` (under 60 characters, never the word or a role): in a terminal, print them beside the clue, like `Kai: stadium — "easy one"`. Do not narrate between calls.
4. When it is the user's turn, stop and ask for one word. Submit it with `imposter_solo_play`.
5. After each round, show the clues so far in a small table (one row per player, one column per round). Then continue.
6. For the vote, make all the AI votes in one `imposter_solo_ai` call, ask the user who they vote for, and submit it with `imposter_solo_play`. If the imposter is caught they get one guess at the word: play it for an AI imposter, ask the user if they are the imposter.
7. When the result comes back, reveal every role and the word, and give a short, playful recap. Offer another game.

Keep it light: this is a break from work, not a task. If the user goes back to work mid-game, stop playing and tell them the game id so they can pick it up later.

If the user asks what else minmini has, call `minmini_games` (it takes `query`, `kind`, `category`, `players` and `page`, eight results a page) and, for one entry's details, `minmini_game` with its id. Print the few that fit in a line each; do not paste the whole list.
