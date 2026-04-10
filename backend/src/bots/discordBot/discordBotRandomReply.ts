// Just a bit of fun so we don't see the same message everytime

import moment from "moment"
import { formatTimeLeft } from "../../shared/utility"
import { Episode } from "../../types/episodeTypes"
import { Movie } from "../../types/movieTypes"
import { MonitorOptions, Series } from "../../types/seriesTypes"
import { qualityAliases } from "./discordBotUtility"

// Display-friendly labels for each quality group
const qualityLabels: Record<string, string> = {
  "4k": "4K",
  "1080": "1080p",
  "720": "720p",
  "480": "480p",
}

// Resolve a raw quality input (e.g. "2160p", "uhd", "sd") to a display-friendly label
const resolveQualityLabel = (quality: string): string => {
  const normalized = quality.toLowerCase().trim()
  const group = Object.entries(qualityAliases).find(([, aliases]) => aliases.includes(normalized))
  return group ? qualityLabels[group[0]] || quality : quality
}

// Pick a random element from an array
const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const longWaitComments = [
  "Sheesh, that's a long wait!",
  "Could finish a whole season before that one's done!",
  "Might be faster to mail you a DVD.",
  "That's not buffering — that's hibernating.",
  "You could fly to Hollywood and film it yourself in less time.",
  "By the time it's done, the sequel might be out.",
  "Even the sloths from Zootopia are judging this speed.",
  "Hope you weren't planning on watching it *today*.",
  "Legend says it's still downloading...",
  "Honestly, you might want to start a new show in the meantime.",
]

export const randomMovieReadyMessage = (name: string, movieTitle: string) => {
  const messages = [
    `Hey ${name}, '${movieTitle}' has finished downloading! Ready to watch. 🍿`,
    `You're good to go, ${name} — '${movieTitle}' is ready for viewing! 🎬`,
    `Download complete, ${name}! '${movieTitle}' is queued up and waiting. 📽️`,
    `${name}, '${movieTitle}' is all set. Press play and enjoy! ▶️`,
    `Enjoy the show, ${name} — '${movieTitle}' is now available! 🎉`,
    `${name}, '${movieTitle}' is in the library. Let movie night begin! 🌙`,
    `'${movieTitle}' just landed, ${name}. Fire it up when you're ready! 🚀`,
    `Done and dusted! '${movieTitle}' is ready to roll, ${name}. 🛋️`,
    `Hey ${name}, '${movieTitle}' is downloaded and waiting. Snacks not included. 🍿`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomNotReleasedMessage = (
  name: string,
  title: string,
  status?: "inCinemas" | "released" | "announced",
) => {
  const statusTaglines: Record<"inCinemas" | "released" | "announced", string[]> = {
    announced: [
      "It's been announced, but there's no release date yet.",
      "It's out there in spirit, there's just no date yet.",
      "Patience, this one's still a while off.",
    ],
    inCinemas: [
      "It's in theaters, but not ready for home viewing.",
      "It's cinematic only right now — off you go!",
      "Unless your living room is a theater, you'll have to wait.",
    ],
    released: [
      "Weird, it should be available... maybe try again shortly?",
      "It claims to be released, but I still can't grab it.",
      "If it's released, it's playing hard to get. Try again later.",
    ],
  }

  const baseMessages = [
    `Hey ${name} — ${title} exists, but it hasn't been released yet.`,
    `Sorry, ${name}, but ${title} hasn't hit the shelves yet.`,
    `I can see ${title} in the database, ${name}, but it's not out in the world yet.`,
    `Yep, ${title} is a real thing — just not released yet. The wait is the hardest part.`,
    `Good eye, ${name}. ${title} is coming... just not available until release day.`,
    `Found it! But not really — ${title} hasn't been released, so no download yet.`,
    `${title}? Oh, it's real. But until it's released, there's nothing I can grab.`,
    `The world knows about ${title}, ${name}, but no one has it yet.`,
    `You're ahead of the curve, ${name}. ${title} hasn't been released to the public yet.`,
    `I checked — ${title} is in the system, but it's not available until its release.`,
  ]

  const base = baseMessages[Math.floor(Math.random() * baseMessages.length)]

  if (status) {
    const taglines = statusTaglines[status]
    const statusMessage = taglines[Math.floor(Math.random() * taglines.length)]
    return `${base} ${statusMessage}`
  }

  return base
}

// Immediate reply when a user requests unreleased media - tells them it's been added and they'll be notified
export const randomUnreleasedAddedMessage = (
  name: string,
  title: string,
  status?: "inCinemas" | "released" | "announced",
) => {
  const statusTaglines: Record<"inCinemas" | "released" | "announced", string[]> = {
    announced: [
      "No release date yet, but I'll be watching.",
      "It's only been announced so far, but I've got my eye on it.",
      "Still a ways off, but I'll keep tabs on it for you.",
    ],
    inCinemas: [
      "It's in theaters right now, so I'll grab it once it hits home release.",
      "Still cinema-only for now — I'll snag it as soon as it's available.",
      "Once it leaves the big screen, it's headed straight to your library.",
    ],
    released: [
      "It should be available soon — I'll grab it as soon as I can.",
      "Might just be a matter of time before it shows up.",
      "I'll keep looking and grab it the moment it's out there.",
    ],
  }

  const baseMessages = [
    `Hey ${name}, '${title}' isn't out yet — but I've added it to your pool. I'll let you know when it's downloaded! 🔔`,
    `${name}, '${title}' hasn't been released yet, but it's on my radar now. You'll get a ping when it lands! 📡`,
    `Got it, ${name}! '${title}' isn't available yet, but I've queued it up. I'll notify you when it's ready. ⏳`,
    `'${title}' is still unreleased, ${name}, but consider it tracked. I'll shout when it's downloaded! 📢`,
    `No worries, ${name} — '${title}' is now in your pool. When it drops and downloads, you'll be the first to know! 🎯`,
    `I can't grab '${title}' just yet, ${name}, but I've added it to your pool and I'll ping you when it's downloaded! 🛎️`,
    `'${title}' isn't out in the wild yet, ${name}. I've saved it to your pool though — sit tight, I'll let you know! 💤`,
    `Consider it done, ${name}. '${title}' is in your pool — I'll hit you up when it's finally available and downloaded! ✨`,
  ]

  const base = baseMessages[Math.floor(Math.random() * baseMessages.length)]

  if (status) {
    const taglines = statusTaglines[status]
    const statusMessage = taglines[Math.floor(Math.random() * taglines.length)]
    return `${base} ${statusMessage}`
  }

  return base
}

// Webhook notification when an unreleased movie has finally been downloaded
export const randomUnreleasedMovieReadyMessage = (name: string, movieTitle: string) => {
  const messages = [
    `${name}, that movie '${movieTitle}' you've been waiting for has been downloaded! 🎬🎉`,
    `The wait is over, ${name}! '${movieTitle}' has finally landed in your library! 🍿`,
    `Remember '${movieTitle}', ${name}? It's here! Downloaded and ready to watch! 🎥`,
    `${name}, '${movieTitle}' just dropped and it's already downloaded for you! Time was well spent waiting! ⏰✅`,
    `Big news, ${name} — '${movieTitle}' is out and downloaded! Your patience has been rewarded! 🏆`,
    `Ding ding! ${name}, '${movieTitle}' is finally here. It's been a long wait, but it's all yours now! 🔔`,
    `${name}, guess what? '${movieTitle}' has been released and downloaded! Go enjoy it! 🎊`,
    `The day has come, ${name}! '${movieTitle}' is downloaded and waiting for you. Worth the wait? 🤩`,
    `Hey ${name}, remember when you asked for '${movieTitle}'? Well, it's downloaded now! Enjoy! 🥳`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

// Webhook notification when an unreleased series has finally been downloaded
export const randomUnreleasedSeriesReadyMessage = (name: string, seriesTitle: string) => {
  const messages = [
    `${name}, that series '${seriesTitle}' you've been waiting for has been downloaded! 📺🎉`,
    `The wait is over, ${name}! '${seriesTitle}' has finally arrived in your library! 🍿`,
    `Remember '${seriesTitle}', ${name}? It's here! Downloaded and ready to binge! 🎬`,
    `${name}, '${seriesTitle}' just dropped and it's already downloaded for you! Time to binge! ⏰✅`,
    `Big news, ${name} — '${seriesTitle}' is out and downloaded! Your patience has paid off! 🏆`,
    `Ding ding! ${name}, '${seriesTitle}' is finally here. The wait is over, get comfy! 🔔`,
    `${name}, guess what? '${seriesTitle}' has been released and downloaded! Happy binging! 🎊`,
    `The day has come, ${name}! '${seriesTitle}' is downloaded and ready. Worth the wait? 🤩`,
    `Hey ${name}, remember when you asked for '${seriesTitle}'? Well, it's downloaded now! Enjoy! 🥳`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomSeriesReadyMessage = (name: string, seriesTitle: string) => {
  const messages = [
    `Hey ${name}, '${seriesTitle}' just finished downloading! Time to binge! 📺`,
    `Good news, ${name} — '${seriesTitle}' is ready and waiting! 🍿`,
    `Episodes are in, ${name}! '${seriesTitle}' is ready to stream. 🎬`,
    `${name}, '${seriesTitle}' is all set. Grab a blanket and dive in! 🛋️`,
    `All downloaded, ${name} — '${seriesTitle}' is in your library now! ✅`,
    `Get comfy, ${name}. '${seriesTitle}' is prepped and ready for your next session. 🛏️`,
    `'${seriesTitle}' is ready to roll, ${name}. Happy watching! 🎉`,
    `${name}, '${seriesTitle}' has landed. Let the marathon begin! 🏁`,
    `Binge mode: activated. '${seriesTitle}' is ready for you, ${name}! 🔥`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomMovieStillNotDownloadedMessage = (movieTitle: string) => {
  const messages = [
    `'${movieTitle}' is still not marked as downloaded after waiting four hours. I'd contact the server owner if I were you.`,
    `No sign of '${movieTitle}' after four hours. Something might be stuck. 🤔`,
    `'${movieTitle}' hasn't finished downloading... and it's been a while. Might want to check in with the server admin.`,
    `Four hours later and still no '${movieTitle}'. Something's up. 🚨`,
    `Hmm, '${movieTitle}' is taking its sweet time. It might need a little human intervention.`,
    `'${movieTitle}' is still missing in action. Recommend contacting the server overlord.`,
    `Still waiting on '${movieTitle}' after four hours. Might be worth kicking the server (gently).`,
    `'${movieTitle}' should be here by now. It's probably stuck in the tubes. 🛠️`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomSeriesStillNotDownloadedMessage = (
  seriesTitle: string,
  timeleft?: string,
): string => {
  const baseMessages = [
    `'${seriesTitle}' still hasn't downloaded after four hours. You might want to give the server admin a nudge.`,
    `No luck with '${seriesTitle}' after four hours. Something might be jammed.`,
    `'${seriesTitle}' is still stuck in limbo. It's probably time to check on the server.`,
    `Four hours in and '${seriesTitle}' is still missing. Might be worth investigating.`,
    `Hmm... '${seriesTitle}' didn't make it through. Server might need some attention.`,
    `'${seriesTitle}' is fashionably late. Too fashionably. Someone should check the pipeline.`,
    `'${seriesTitle}' is still MIA after four hours. Might be time to reboot something.`,
    `Still no '${seriesTitle}' after a full shift. Maybe the server took a nap.`,
    `'${seriesTitle}' didn't make the cut-off. Give the server overlord a gentle prod.`,
  ]

  const message = baseMessages[Math.floor(Math.random() * baseMessages.length)]

  return timeleft ? `${message} (Last episode finishes downloading in: ${timeleft})` : message
}

export const randomProcessingMessage = () => {
  const messages = [
    "Hold on a sec...",
    "Strap in!",
    "Just a moment while I work my magic...",
    "Hang tight, doing some wizardry 🧙‍♂️",
    "Crunching the numbers...",
    "One sec, contacting the media gods 📡",
    "Gimme a moment — lining everything up...",
    "Booting up the content engine... 🔧",
    "Working on it — don't go anywhere!",
    "Stand by... automation in progress 🤖",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomNotFoundMessage = () => {
  const messages = [
    "Hmm... I couldn't find that one.",
    "No luck finding it, sorry!",
    "I looked, but came up empty.",
    "That's not showing up for me.",
    "I couldn't track that down.",
    "I didn't see anything matching that.",
    "Couldn't find it — maybe double-check the title or year?",
    "That one's not popping up. Got another title?",
    "Nothing came up on my end — want to try again?",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomAlreadyAddedMessage = () => {
  const messages = [
    "You've already got that one — try to keep up!",
    "Nice try, but that's already in your stash.",
    "That one's been downloaded already, champ.",
    "Check your collection, genius!",
    "You've added that before. Memory like a goldfish?",
    "Old news! You've already added that.",
    "Yep, you've got that one. Impressive attention to detail... not.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

// Random message for when content is already downloaded but was missing from the user's pool
export const randomReAddedToPoolMessage = (title: string) => {
  const messages = [
    `"${title}" is already downloaded — I've added it back to your pool.`,
    `That one's already here! I've popped "${title}" back into your pool.`,
    `"${title}" never left the library — just your pool. Fixed that for you!`,
    `Welcome back, "${title}"! Re-added to your pool.`,
    `"${title}" was still downloaded — I've slotted it back into your pool.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomInLibraryNotDownloadedMessage = () => {
  const messages = [
    "It's in your library — just waiting for you to hit download.",
    "Already in the library, but not on your device yet!",
    "You own it, but it's still chilling in the cloud.",
    "That one's in your library — now give it a proper home.",
    "You've got it, just not downloaded yet. Slacking?",
    "In your collection, but not downloaded. Why the delay?",
    "It's yours, just not on your device. Yet.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomAddedToPoolMessage = (contentType: "Movie" | "Series", title: string) => {
  const messages = [
    `${title} has been added to your ${contentType.toLowerCase()} pool. It's safe and sound.`,
    `No worries — ${title} is now part of your ${contentType.toLowerCase()} collection.`,
    `${contentType} locked in! ${title} won't be removed from the server.`,
    `${title} is staying put. It's been added to your ${contentType.toLowerCase()} pool.`,
    `You're keeping ${title}? Got it. It won't be touched.`,
    `${title} is in your ${contentType.toLowerCase()} pool now — it's going nowhere.`,
    `Nice choice. ${title} is now permanently in your ${contentType.toLowerCase()} stack.`,
  ]

  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomGrabbedMessage = (title: string) => {
  const messages = [
    `${title} has been found and the download has started. Get your popcorn ready!`,
    `Great news — ${title} is downloading now. It'll be ready before you know it.`,
    `We found ${title} and it's now being downloaded straight to your library.`,
    `${title} matched a source and the download is underway.`,
    `${title} is officially on the way — downloading as we speak.`,
    `Heads up! ${title} is downloading after being matched with a source.`,
    `Match found: ${title}. Download just kicked off.`,
    `${title} has been picked up and the download has started.`,
    `No need to hunt — ${title} has been located and is downloading now.`,
  ]

  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomGrabNotFoundMessage = (title: string) => {
  const messages = [
    `I checked around, but couldn't find ${title} online.`,
    `I searched for ${title}, but nothing turned up.`,
    `No luck — I couldn't find ${title} from any sources.`,
    `I looked, but ${title} didn't show up anywhere.`,
    `${title} wasn't available when I checked.`,
    `I gave it a shot, but ${title} wasn't out there.`,
    `Scanned the usual spots — no sign of ${title}.`,
    `Tried to find ${title}, but came up empty.`,
    `${title}? I searched, but there was nothing to pull in.`,
    `I looked for ${title}, but it didn't seem to be available right now.`,
  ]

  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomQueuedMessage = (timeLeft?: string): string => {
  let eta = ""
  let longWaitNote = ""

  if (timeLeft) {
    const duration = moment.duration(timeLeft)
    const formatted = formatTimeLeft(timeLeft)
    eta = ` — last one finishes in ${formatted}`

    if (duration.asHours() > 8) {
      const note = longWaitComments[Math.floor(Math.random() * longWaitComments.length)]
      longWaitNote = ` — ${note}`
    }
  }

  const messages = [
    `Your request is queued${eta}${longWaitNote}.`,
    `It's in line to be downloaded${eta}${longWaitNote}. Hang tight.`,
    `That one's queued${eta}${longWaitNote}. We'll grab it as soon as we can.`,
    `Added to the download queue${eta}${longWaitNote}. Shouldn't be long now.`,
    `Waiting in the queue${eta}${longWaitNote} — we haven't forgotten it.`,
    `Your download is doing the digital equivalent of waiting at the DMV${eta}${longWaitNote}.`,
    `It's in the queue — possibly behind someone's entire anime backlog${eta}${longWaitNote}.`,
    `We've got it lined up${eta}${longWaitNote}. Just waiting for the stars to align.`,
    `It's waiting for the servers to finish their coffee break${eta}${longWaitNote}.`,
    `Queued... kind of like that email you meant to send three days ago${eta}${longWaitNote}.`,
    `It's in queue purgatory${eta}${longWaitNote}. Be patient, or sacrifice a USB stick to the gods.`,
    `Queued and comfy. It'll get there. Probably before the heat death of the universe${eta}${longWaitNote}.`,
  ]

  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomDownloadingMessage = (timeLeft?: string): string => {
  let eta = ""
  let longWaitNote = ""

  if (timeLeft) {
    const duration = moment.duration(timeLeft)
    const formatted = formatTimeLeft(timeLeft)
    eta = ` — finishes in ${formatted}`

    if (duration.asHours() > 8) {
      const note = longWaitComments[Math.floor(Math.random() * longWaitComments.length)]
      longWaitNote = ` — ${note}`
    }
  }

  const messages = [
    `It's downloading now${eta}${longWaitNote}.`,
    `The movie is on its way${eta}${longWaitNote}.`,
    `Download started successfully${eta}${longWaitNote}.`,
    `Your movie is being fetched as we speak${eta}${longWaitNote}.`,
    `Hang tight — it's downloading${eta}${longWaitNote}.`,
    `All set! The download is in progress${eta}${longWaitNote}.`,
    `Sit back — your movie is coming through${eta}${longWaitNote}.`,
    `It's working its way onto your library${eta}${longWaitNote}.`,
    `It's in motion — no need to do anything else${eta}${longWaitNote}.`,
    `The bits are flowing — your movie is en route${eta}${longWaitNote}.`,
  ]

  return messages[Math.floor(Math.random() * messages.length)]
}

const randomPausedMessage = () => {
  const messages = [
    "The download is paused. Only the server overlord can bring it back to life.",
    "Download currently paused — you'll need to ask the mighty server owner to resume it.",
    "It's on hold. Only the chosen one (a.k.a. the server owner) can unpause it.",
    "Download paused. Summon the server god if you want it moving again.",
    "This one's in stasis. Only the keeper of the server keys can release it.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomCompletedMessage = () => {
  const messages = [
    "The download is complete but still stuck in the queue. Only the mighty server owner can investigate and bring it home.",
    "Download's done, but something's holding it back. Time to alert the server deity.",
    "It finished downloading, but hasn't moved forward. The server overlord must intervene.",
    "Complete, yet unmoved — like a warrior waiting for orders. Summon the server god to finish the job.",
    "It's downloaded but not ready yet. Only the great server owner can descend from the clouds and fix this.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomImportedMessage = () => {
  const messages = [
    "All done. It's downloaded and added to your library.",
    "Finished and ready — it should be available to watch.",
    "Successfully added to your collection.",
    "That one's now part of your library. Enjoy.",
    "It's in — check your collection. You're good to go.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomFailedMessage = () => {
  const messages = [
    "The download failed. Might be a broken link or bad source.",
    "That one didn't go through. Try another release.",
    "Download failed — something went wrong with the process.",
    "No luck — the download crashed or couldn't complete.",
    "Something broke. That download didn't make it.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomWarningMessage = () => {
  const messages = [
    "There's a warning on this one — might be a quality issue.",
    "Download succeeded, but the server isn't fully happy with it.",
    "It's flagged with a warning. Maybe double-check it.",
    "the server thinks something's off — might be worth a second look.",
    "That one came with a warning. Could still be fine, but be cautious.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const getMovieStatusMessage = (status: string, time?: string): string => {
  switch (status.toLowerCase()) {
    case "queued":
      return randomQueuedMessage(time)
    case "downloading":
      return randomDownloadingMessage(time)
    case "paused":
      return randomPausedMessage()
    case "completed":
      return randomCompletedMessage()
    case "imported":
      return randomImportedMessage()
    case "failed":
      return randomFailedMessage()
    case "warning":
      return randomWarningMessage()
    default:
      return "I'm not quite sure what's going on with this one. Might be time to ask the server guru."
  }
}

export const randomMovieDownloadStartMessage = (movie: Movie) => {
  const messages = [
    `Popcorn ready? '${movie.title}' is on its way! 🍿`,
    `Download started for '${movie.title}' — time to get cozy! 🎬`,
    `Here comes the magic! '${movie.title}' is rolling in. ✨`,
    `'${movie.title}' is downloading — movie night is officially ON! 🔥`,
    `Hold onto your seats, '${movie.title}' is arriving! 🚀`,
    `You're in for a treat — '${movie.title}' is downloading now! 🍭`,
    `The reels are turning! '${movie.title}' is coming your way. 🎞️`,
    `'${movie.title}' is en route! Let the cinematic vibes begin. 🛤️`,
    `Cheers! '${movie.title}' is being summoned from the movie gods. 🍷🎥`,
    `'${movie.title}' is downloading — excellent choice, by the way. 😎`,
  ]
  return pickRandom(messages)
}

// Movie download start message when a quality preference was specified
export const randomMovieQualityDownloadStartMessage = (movie: Movie, quality: string) => {
  const label = resolveQualityLabel(quality)
  const title = movie.title

  const qualityMessages: Record<string, string[]> = {
    "4K": [
      `Got it! '${title}' is downloading in glorious 4K — your eyeballs are in for a treat! 👁️✨`,
      `'${title}' in 4K? Oh fancy! Downloading now in ultra-high definition. 🎩🍿`,
      `4K Ultra HD locked in for '${title}'! Hope your screen can keep up! 🖥️🔥`,
      `'${title}' in 4K coming right up! Every pixel is gonna count. 💎`,
      `You want '${title}' in 4K? Say no more! Downloading the crispest version I can find. 🤌✨`,
      `4K mode activated for '${title}'! Prepare for ridiculous levels of detail. 🤯`,
      `'${title}' in glorious 4K — because you deserve to see every blade of grass. 🌿📺`,
      `Downloading '${title}' in 4K! Your storage might cry, but your eyes will thank you. 💾😍`,
    ],
    "1080p": [
      `'${title}' in 1080p coming right up! The sweet spot of quality. 🎯`,
      `Full HD locked in! '${title}' is downloading in crisp 1080p. 📺✨`,
      `'${title}' in 1080p — sharp, clean, and not gonna eat all your storage. Smart choice! 👌`,
      `1080p it is! '${title}' is downloading in Full HD. Very sensible. 🧠`,
      `Got it! '${title}' in 1080p — the Goldilocks of resolutions. Not too big, not too small. 🐻`,
      `'${title}' downloading in 1080p! Sharp enough to see the boom mic in every scene. 🎤😄`,
      `1080p for '${title}' — quality and storage living in perfect harmony. ☮️🍿`,
      `'${title}' in 1080p — because you have standards, but also a hard drive budget. 💸`,
    ],
    "720p": [
      `'${title}' in 720p — keeping it practical! Downloading now. 📺`,
      `720p for '${title}'! Still looks great, I promise. Downloading! 👍`,
      `Got it! '${title}' in 720p — light on storage, easy on the bandwidth. 🪶`,
      `'${title}' downloading in 720p! Your hard drive will barely notice. 💨`,
      `720p selected for '${title}' — efficient and effective! On it! 🎯`,
      `'${title}' in 720p? Perfect for those 'I just want to watch something' moments. Downloading! 🛋️`,
      `Going 720p for '${title}' — more room for more content! 📦`,
      `'${title}' in 720p — small footprint, big entertainment. Downloading now! 🎬`,
    ],
    "480p": [
      `'${title}' in 480p — going old school! Respect. Downloading now! 📼`,
      `SD quality for '${title}'! Tiny files, big entertainment. On it! 🤏🎬`,
      `'${title}' in 480p — because it's the content that counts, right? Downloading! 🧐`,
      `480p for '${title}'! Your storage sends its thanks. Downloading now! 🙏`,
      `'${title}' in 480p — retro vibes only. Coming right up! 🕹️`,
      `Going with 480p for '${title}'! Squint and it's basically HD. 😄📺`,
      `'${title}' in 480p — saving bandwidth like a true hero. Downloading! 🦸`,
      `480p for '${title}'! Maximum content, minimum storage. Love the efficiency! 📼✨`,
    ],
  }

  const messages = qualityMessages[label]
  if (!messages || messages.length === 0) return randomMovieDownloadStartMessage(movie)
  return pickRandom(messages)
}

// Series download start message when no special monitor or quality args are specified (monitor=all)
export const randomSeriesDownloadStartMessage = (series: Series) => {
  const messages = [
    `Binge mode: activated! '${series.title}' is on the way. 📺`,
    `Here we go — '${series.title}' is starting to download! 🍿`,
    `'${series.title}' is joining the library. Get comfy! 🛋️`,
    `Episodes inbound! '${series.title}' is downloading now. 🚚`,
    `Get ready for a wild ride — '${series.title}' is coming in hot! 🔥`,
    `One episode at a time... '${series.title}' is on the move! 🎬`,
    `'${series.title}' is headed your way. It's series time! 📦`,
    `Cue the theme song — '${series.title}' is downloading. 🎵`,
    `'${series.title}' is loading up. Snacks not included. 🍪`,
    `📡 Incoming transmission: '${series.title}' has entered the download zone.`,
  ]
  return pickRandom(messages)
}

// Series download start message when a monitor option is specified (no quality)
export const randomSeriesMonitorDownloadStartMessage = (series: Series, monitor: MonitorOptions) => {
  const title = series.title

  const monitorMessages: Record<string, string[]> = {
    future: [
      `'${title}' is added! I'll only grab episodes that haven't aired yet — no backlog, just the fresh stuff! 📡`,
      `Future episodes only for '${title}'! I'll snag them as they air. No past, just vibes. 🔮`,
      `'${title}' locked in for future episodes! You're living in the now — only new episodes headed your way. ⏭️`,
      `On it! '${title}' future episodes only — time to catch up on other shows while you wait for new ones! 📺`,
      `'${title}' is set up! Only upcoming episodes will be grabbed — the past stays in the past. 🚀`,
      `Future-only mode for '${title}'! I'll keep watch for new episodes as they drop. 👀`,
    ],
    missing: [
      `On it! I'll hunt down any missing episodes of '${title}' and keep an eye on future ones too! 🔍`,
      `'${title}' — tracking down what's missing plus any future releases. Double duty! 🕵️`,
      `Missing episodes of '${title}' detected — time for some digital archaeology! Future ones too! 🏺`,
      `'${title}' is in! I'll fill the gaps in your collection and grab anything new that airs. 🧩`,
      `Downloading missing episodes of '${title}' and watching for new releases — I'm on both cases! 📋`,
      `'${title}' — any episodes without files plus future ones are on my radar now! 📡`,
    ],
    existing: [
      `'${title}' is locked in! I'll keep tabs on episodes you already have plus anything new coming out. 📦`,
      `Existing episodes of '${title}' stay monitored, and future ones will join the party! 🎉`,
      `'${title}' — maintaining your current collection and tracking future releases! 🔧`,
      `Got it! '${title}' — I'll watch the episodes you have and grab new ones as they air. 👀📺`,
      `'${title}' set up! Monitoring episodes with files or that haven't aired yet. 📂`,
      `'${title}' is on! Keeping your existing episodes in check and eyes peeled for new ones. 🦅`,
    ],
    recent: [
      `'${title}' — grabbing episodes from the last 90 days plus anything coming up! Staying current! 📅`,
      `Recent episodes mode for '${title}'! Last 90 days and future releases only — keeping it fresh! 🌱`,
      `'${title}' is in! I'll grab the last 90 days' worth, plus anything new that drops. No ancient history! 📆`,
      `You're in the modern era! '${title}' — recent and future episodes incoming! 🏃`,
      `'${title}' locked in for recent episodes! The last 90 days plus the future — no dusty archives here. 🧹`,
      `Recent mode for '${title}'! Fresh episodes and upcoming releases only. Staying trendy! 😎`,
    ],
    pilot: [
      `Just the pilot? Bold strategy! Downloading only the first episode of '${title}' — let's see if it hooks you! 🎣`,
      `Testing the waters with '${title}'! Just the pilot episode — one episode to rule them all. 💍`,
      `First episode of '${title}' only — gotta see if it's worth the commitment! Smart move. 🧠`,
      `'${title}' pilot inbound! Starting with episode one — your toe is officially in the water. 🏊`,
      `Just the pilot of '${title}'? Alright! Let's see if this show's got wings! 🦋`,
      `One episode. That's it. '${title}' pilot downloading — no pressure, just vibes. 🎬`,
    ],
    firstSeason: [
      `Just the first season? Alright if you're sure! Downloading season one of '${title}' now! 🎬`,
      `Season 1 of '${title}' only — keeping it simple and focused! All other seasons will chill for now. 🧊`,
      `'${title}' first season coming up! A controlled binge situation — I respect it. 🍿`,
      `Downloading just season one of '${title}'! Starting from the beginning — the rest can wait. ⏳`,
      `First season of '${title}' on the way! Baby steps into a new series — smart approach! 👣`,
      `Season one of '${title}' locked in! Let's see if this show earns the other seasons. 🏆`,
    ],
    lastSeason: [
      `Skipping straight to the latest season of '${title}'! No spoiler-free zone here! 🏃💨`,
      `Latest season of '${title}' only — jumping straight to the good stuff! 🎯`,
      `Just the most recent season of '${title}' — you're cutting to the chase! Love it. ✂️`,
      `'${title}' last season incoming! No time for backstory — straight to the action! 💥`,
      `Most recent season of '${title}' only — living on the edge of the plot! 🗺️`,
      `Last season of '${title}' downloading! Who needs context anyway? 😄📺`,
    ],
    monitorSpecials: [
      `Specials mode on for '${title}'! Bonus episodes, behind-the-scenes — all the extras coming your way! 🎁`,
      `'${title}' specials are now being tracked! Because bonus content matters. 🌟`,
      `Monitoring special episodes of '${title}' — no director's cuts left behind! 🎬✨`,
      `'${title}' specials locked in! Extra goodies included — you want the full experience! 🎭`,
      `Special episodes of '${title}' are on my radar! The main episodes won't be affected. 📡`,
      `'${title}' — specials are now monitored! Holiday specials, bonus eps, the works! 🎄🎬`,
    ],
    unmonitorSpecials: [
      `Turning off specials for '${title}' — sticking to the main storyline only! 🎯`,
      `'${title}' specials? Nah. Skipping special episodes — just the core narrative for you! 📖`,
      `Special episodes of '${title}' are off the radar! Mainline content only. No distractions! 🚫✨`,
      `'${title}' — unmonitoring specials! Regular episodes stay untouched. Clean and focused! 🧹`,
      `Specials for '${title}' are out! Just the main episodes — no bonus fluff. 🎬`,
      `'${title}' — special episodes need not apply! Main storyline only from here. 📺`,
    ],
  }

  const messages = monitorMessages[monitor]
  if (!messages || messages.length === 0) return randomSeriesDownloadStartMessage(series)
  return pickRandom(messages)
}

// Series download start message when a quality preference is specified (monitor=all)
export const randomSeriesQualityDownloadStartMessage = (series: Series, quality: string) => {
  const label = resolveQualityLabel(quality)
  const title = series.title

  const qualityMessages: Record<string, string[]> = {
    "4K": [
      `'${title}' in 4K is on the way! Every frame in ultra-high detail. Your TV is about to earn its keep! 📺✨`,
      `4K Ultra HD for '${title}'! Downloading the sharpest version available. Buckle up! 🚀`,
      `'${title}' in glorious 4K! This is going to look absolutely stunning. Downloading now! 💎`,
      `Got it! '${title}' in 4K — because binge-watching in anything less would be a crime. 👨‍⚖️`,
      `'${title}' downloading in 4K! Your storage might need therapy, but your eyes will be in heaven. 😍`,
      `4K locked in for '${title}'! Every pore, every raindrop, every dramatic zoom — in perfect detail. 🔍`,
      `'${title}' in 4K coming right up! Time to see what your screen is really capable of. 🖥️🔥`,
      `Downloading '${title}' in 4K UHD! Premium quality for premium binge-watching. 🍿✨`,
    ],
    "1080p": [
      `'${title}' in 1080p — the perfect balance! Downloading now. 🎯📺`,
      `Full HD for '${title}'! Crisp, clean, and sensibly sized. Great choice! 👌`,
      `'${title}' in 1080p coming right up! Sharp visuals without melting your hard drive. 🧊`,
      `1080p locked in for '${title}'! The Goldilocks resolution — just right. 🐻`,
      `Downloading '${title}' in 1080p! Quality and storage, living in harmony. ☮️`,
      `'${title}' in Full HD! Every episode in crisp 1080p — binge responsibly! 📺`,
      `Got it! '${title}' in 1080p — because you have taste AND a storage budget. 💸✨`,
      `'${title}' downloading in 1080p! The sweet spot where quality meets common sense. 🧠`,
    ],
    "720p": [
      `'${title}' in 720p — lean, mean, and still looks great! Downloading now. 📺`,
      `720p for '${title}'! Light on storage, heavy on entertainment. On it! 🪶`,
      `Got it! '${title}' in 720p — your bandwidth and hard drive both send their thanks. 🙏`,
      `'${title}' downloading in 720p! More room for more shows. Smart thinking! 🧠`,
      `720p locked in for '${title}'! Efficient binge-watching — I respect the strategy. 📦`,
      `'${title}' in 720p coming right up! Still looks fantastic, downloads way faster. ⚡`,
      `Downloading '${title}' in 720p! Small footprint, maximum binge potential. 🎬`,
      `'${title}' in 720p — practical and still pretty. The Honda Civic of resolutions! 🚗`,
    ],
    "480p": [
      `'${title}' in 480p — classic vibes! Downloading now. 📼`,
      `SD for '${title}'! Tiny files, huge entertainment value. Coming right up! 🤏🎬`,
      `'${title}' in 480p? You're a storage efficiency legend. Downloading! 🦸`,
      `480p locked in for '${title}'! Retro resolution, modern content. Love it! 🕹️`,
      `Got it! '${title}' in 480p — because it's the story that counts, not the pixels. 📖`,
      `Downloading '${title}' in 480p! Your hard drive is throwing a party right now. 🎉💾`,
      `'${title}' in 480p — maximum episodes, minimum space. Downloading now! 📺`,
      `480p for '${title}'! Squint a little and it's basically 4K. Downloading! 😄`,
    ],
  }

  const messages = qualityMessages[label]
  if (!messages || messages.length === 0) return randomSeriesDownloadStartMessage(series)
  return pickRandom(messages)
}

// Series download start message when BOTH quality and monitor options are specified
export const randomSeriesQualityMonitorDownloadStartMessage = (
  series: Series,
  monitor: MonitorOptions,
  quality: string,
) => {
  const label = resolveQualityLabel(quality)
  const title = series.title

  // Every quality × monitor combination gets its own set of fully integrated messages
  const comboMessages: Record<string, Record<string, string[]>> = {
    "4K": {
      future: [
        `'${title}' in 4K, future episodes only! Ultra-HD quality for every new episode as it drops. 🔮✨`,
        `Future episodes of '${title}' in glorious 4K! Your TV will be working overtime when new ones air. 📡💎`,
        `4K and future-only for '${title}'! No backlog, just pristine new episodes in ultra-high def. 🚀`,
        `'${title}' — 4K resolution, future episodes only. Maximum quality, zero archaeology. Living in the now! 🌟`,
        `Got it! '${title}' future episodes in 4K! Each new episode will look absolutely stunning. 👁️✨`,
      ],
      missing: [
        `'${title}' in 4K — hunting down missing episodes in ultra-HD! Plus I'll grab future ones too. 🔍💎`,
        `Missing episodes of '${title}' in 4K! Filling those gaps with the crispest quality possible. 🧩✨`,
        `4K quality for '${title}' — tracking down what you're missing in glorious detail! Future episodes included. 🕵️`,
        `'${title}' missing + future episodes, all in 4K! Digital archaeology just got a serious upgrade. 🏺💎`,
        `Got it! Every missing episode of '${title}' in 4K, plus future releases. Your collection will be stunning! 🌟`,
      ],
      existing: [
        `'${title}' in 4K — monitoring existing episodes and future releases in ultra-HD! 📦💎`,
        `4K quality locked in for '${title}'! Keeping tabs on what you have and grabbing new ones in stunning detail. 👀✨`,
        `'${title}' — existing and future episodes, all in 4K. Your library just got a premium upgrade! 🎩`,
        `Got it! '${title}' in 4K for existing and upcoming episodes. Quality and coverage! 📺💎`,
        `Monitoring '${title}' in 4K! Episodes you have plus future ones — all in ultra-high definition. 🔥`,
      ],
      recent: [
        `'${title}' in 4K — last 90 days and future episodes in ultra-HD! Fresh AND gorgeous. 📅💎`,
        `Recent episodes of '${title}' in 4K! The last 90 days in stunning detail, plus anything new. 🌱✨`,
        `4K and recent mode for '${title}'! Modern episodes in maximum quality — no ancient history. 🏃💎`,
        `'${title}' — recent and future episodes, all in glorious 4K. Staying current in style! 😎✨`,
        `Got it! '${title}' in 4K, recent episodes only. The freshest content in the crispest quality! 🔥`,
      ],
      pilot: [
        `Just the pilot of '${title}' in 4K? Going all-out on first impressions! Downloading now! 🎬💎`,
        `One episode. 4K. Maximum impact. '${title}' pilot downloading in ultra-HD! 💥✨`,
        `Testing '${title}' with the pilot in 4K! If one episode is all you get, might as well make it gorgeous. 👁️🔥`,
        `'${title}' pilot in 4K — the most visually stunning way to test-drive a new show! 🚗💎`,
        `Got it! Just the pilot of '${title}' in glorious 4K. No commitment, maximum pixels! 🤌✨`,
      ],
      firstSeason: [
        `Well alright alright alright! Just the first season of '${title}' in 4K quality! Coming right up! 🎬✨`,
        `Season one of '${title}' in 4K! Starting the journey in ultra-HD — what a way to begin. 🚀💎`,
        `'${title}' first season downloading in 4K! Every frame of season one in glorious detail. 💎📺`,
        `First season of '${title}' in 4K? Bold and beautiful. Downloading now! 🌟`,
        `Got it! Season one of '${title}' in 4K — if you're gonna start, start in style! 🎩✨`,
      ],
      lastSeason: [
        `Latest season of '${title}' in 4K! Skipping to the good stuff in ultra-HD. 🏃💎`,
        `'${title}' last season in 4K — cutting straight to the action in the crispest quality! ✂️✨`,
        `Most recent season of '${title}' in glorious 4K! Who needs context when you have pixels? 😄💎`,
        `Last season of '${title}' downloading in 4K! The grand finale deserves the grand resolution. 🎆`,
        `Got it! '${title}' latest season in 4K — jumping to the end in style! 🏆✨`,
      ],
      monitorSpecials: [
        `Specials for '${title}' in 4K! Bonus content deserves bonus quality. 🎁💎`,
        `'${title}' special episodes in 4K — behind-the-scenes in ultra-high definition! 🎬✨`,
        `4K specials for '${title}'! Every bonus episode in glorious detail. 🌟`,
        `Monitoring specials of '${title}' in 4K! The extras just became the main event. 🎭💎`,
        `Got it! '${title}' specials in 4K — because even bonus content deserves the royal treatment. 👑`,
      ],
      unmonitorSpecials: [
        `'${title}' in 4K, no specials — pure main storyline in ultra-HD! 🎯💎`,
        `Unmonitoring specials for '${title}', keeping it 4K for the core episodes! Focused and stunning. 🔥`,
        `'${title}' — 4K quality, main episodes only. No special episode distractions! 📺💎`,
        `Specials off, 4K on for '${title}'! Just the main story in glorious detail. ✨`,
        `Got it! '${title}' main storyline only in 4K — clean, focused, and crystal clear. 🎬💎`,
      ],
    },
    "1080p": {
      future: [
        `'${title}' in 1080p, future episodes only! Crisp quality for every new episode. 📡🎯`,
        `Future episodes of '${title}' in Full HD! New episodes in sharp 1080p as they air. 📺`,
        `1080p and future-only for '${title}'! Sensible quality, forward-looking schedule. Love it! 🧠`,
        `'${title}' — 1080p, future episodes only. Smart resolution, smart monitoring. The double whammy! ✨`,
        `Got it! '${title}' future episodes in 1080p. Clean quality, no backlog. Perfect setup! 👌`,
      ],
      missing: [
        `'${title}' in 1080p — filling those missing episode gaps in Full HD! Future ones too. 🧩`,
        `Missing episodes of '${title}' in 1080p! Hunting them down in crisp quality. 🔍📺`,
        `1080p for '${title}' missing and future episodes! Filling gaps with style. 💪`,
        `'${title}' — tracking down what's missing in 1080p. Plus future releases. On the case! 🕵️`,
        `Got it! Missing episodes of '${title}' in 1080p — your collection is about to look sharp! ✨`,
      ],
      existing: [
        `'${title}' in 1080p — keeping your existing episodes monitored plus future ones! All in Full HD. 📦`,
        `1080p locked in for '${title}'! Existing and future episodes in crisp quality. 👀`,
        `'${title}' — existing and upcoming episodes in 1080p. Solid setup! 🔧`,
        `Monitoring '${title}' in 1080p! What you have plus what's coming — all sharp. 📺`,
        `Got it! '${title}' in 1080p for existing and future episodes. Clean and practical! 👌`,
      ],
      recent: [
        `'${title}' in 1080p — recent episodes plus future ones! Last 90 days in Full HD. 📅`,
        `Recent mode for '${title}' in 1080p! Fresh content in sharp quality. 🌱`,
        `1080p and recent for '${title}'! The last 90 days in crisp Full HD, plus anything new. 📺`,
        `'${title}' — recent and future episodes in 1080p. Staying current, staying sharp! 🎯`,
        `Got it! '${title}' in 1080p, recent episodes only. Modern content, sensible quality! 🧠`,
      ],
      pilot: [
        `Testing the waters with just the pilot of '${title}' in 1080p — smart and sharp! 🧠`,
        `'${title}' pilot in 1080p! One episode to decide, and it'll look great doing it. 🎬`,
        `Just the pilot of '${title}' in Full HD! Crisp first impressions. 📺`,
        `'${title}' pilot downloading in 1080p — giving it the fair trial it deserves! ⚖️`,
        `Got it! '${title}' pilot in 1080p. Minimal commitment, maximum clarity! 🔍`,
      ],
      firstSeason: [
        `First season of '${title}' in 1080p! Starting the journey in Full HD — great combo! 🎬📺`,
        `Season one of '${title}' in 1080p — the sensible binge begins! Downloading now. 🧠`,
        `'${title}' season one in Full HD! A controlled binge in crisp quality. 🍿`,
        `Just the first season of '${title}' in 1080p — smart resolution, smart approach. Love it! 👌`,
        `Got it! Season one of '${title}' in 1080p. Sharp quality, no over-commitment! ✨`,
      ],
      lastSeason: [
        `Latest season of '${title}' in 1080p! Straight to the action in Full HD. 🏃📺`,
        `'${title}' last season in 1080p — cutting to the chase in sharp quality! ✂️`,
        `Most recent season of '${title}' in 1080p! No filler, just the latest in Full HD. 🎯`,
        `Last season of '${title}' downloading in 1080p! The end game looks crisp. 🔥`,
        `Got it! '${title}' latest season in 1080p — jumping ahead in style! 🚀`,
      ],
      monitorSpecials: [
        `Specials for '${title}' in 1080p! Bonus content in Full HD. 🎁📺`,
        `'${title}' special episodes in 1080p — the extras in crisp quality! 🌟`,
        `Monitoring specials of '${title}' in 1080p! Because even bonus episodes deserve clarity. ✨`,
        `1080p specials for '${title}'! Full HD bonus content coming your way. 🎬`,
        `Got it! '${title}' specials in 1080p — quality extras for quality watching! 👌`,
      ],
      unmonitorSpecials: [
        `'${title}' in 1080p, no specials — main storyline in crisp Full HD! 🎯📺`,
        `Unmonitoring specials for '${title}', 1080p for the core episodes! Focused and sharp. 🔍`,
        `'${title}' — 1080p quality, main episodes only. No filler! 📺`,
        `Specials off, 1080p on for '${title}'! Just the main story in Full HD. ✨`,
        `Got it! '${title}' main storyline only in 1080p — lean, clean, and sharp. 🧹`,
      ],
    },
    "720p": {
      future: [
        `'${title}' in 720p, future episodes only! Lightweight and forward-looking. 📡🪶`,
        `Future episodes of '${title}' in 720p! New episodes without hogging your storage. ⚡`,
        `720p and future-only for '${title}'! Fast downloads, fresh episodes. Win-win! 🏆`,
        `'${title}' — 720p, future episodes only. Efficient all around! 🎯`,
        `Got it! '${title}' future episodes in 720p. Small files, big anticipation! 📺`,
      ],
      missing: [
        `'${title}' in 720p — tracking down missing episodes without eating your storage! 🔍🪶`,
        `Missing episodes of '${title}' in 720p! Filling gaps efficiently. 🧩`,
        `720p for '${title}' missing and future episodes! Quick downloads, complete collection. 💨`,
        `'${title}' — hunting down what's missing in 720p. Light on space, heavy on results! ⚡`,
        `Got it! Missing episodes of '${title}' in 720p — lean and mean gap-filling! 🎯`,
      ],
      existing: [
        `'${title}' in 720p — monitoring existing and future episodes on the light side! 📦🪶`,
        `720p for '${title}'! Existing and future episodes, storage-friendly. 📺`,
        `'${title}' — existing and upcoming in 720p. Practical and efficient! 🔧`,
        `Monitoring '${title}' in 720p! What you have plus what's coming — no bloat. ⚡`,
        `Got it! '${title}' in 720p for existing and future episodes. Lean and lovely! 💪`,
      ],
      recent: [
        `'${title}' in 720p — recent episodes and future ones! Light and current. 📅🪶`,
        `Recent mode for '${title}' in 720p! Fresh content, fast downloads. 🌱`,
        `720p and recent for '${title}'! The last 90 days, minimal storage impact. ⚡`,
        `'${title}' — recent and future in 720p. Staying current, staying light! 🏃`,
        `Got it! '${title}' in 720p, recent episodes. Efficient and up to date! 📺`,
      ],
      pilot: [
        `'${title}' pilot in 720p — quick download, quick decision! Let's see if it hooks you. 🎣`,
        `Just the pilot of '${title}' in 720p! Minimal storage for maximum test-driving. 🚗`,
        `'${title}' pilot downloading in 720p — fast, light, and straight to the point! ⚡`,
        `One episode of '${title}' in 720p! The ultimate low-commitment trial. 🎬`,
        `Got it! '${title}' pilot in 720p. Quick grab, quick watch, quick verdict! 🏃`,
      ],
      firstSeason: [
        `First season of '${title}' in 720p! A whole season that barely dents your storage. 📦`,
        `Season one of '${title}' in 720p — efficient bingeing at its finest! 🪶`,
        `'${title}' first season in 720p! Light downloads, full season. Nice balance! ⚖️`,
        `Just season one of '${title}' in 720p — practical approach, I respect it! 👍`,
        `Got it! Season one of '${title}' in 720p. Maximum episodes, minimum footprint! 📺`,
      ],
      lastSeason: [
        `Latest season of '${title}' in 720p! Straight to the latest, light on storage. 🏃🪶`,
        `'${title}' last season in 720p — cutting to the chase, keeping it lean! ✂️`,
        `Most recent season of '${title}' in 720p! Quick downloads, latest content. ⚡`,
        `Last season of '${title}' in 720p — no fuss, no bloat, just the good stuff! 📺`,
        `Got it! '${title}' latest season in 720p — fast and focused! 🎯`,
      ],
      monitorSpecials: [
        `Specials for '${title}' in 720p! Bonus content, light on storage. 🎁🪶`,
        `'${title}' special episodes in 720p — extras without the extra space! 📺`,
        `Monitoring specials of '${title}' in 720p! Efficient bonus content! ⚡`,
        `720p specials for '${title}'! All the extras, none of the storage guilt. 🎬`,
        `Got it! '${title}' specials in 720p — lean bonus content! 👌`,
      ],
      unmonitorSpecials: [
        `'${title}' in 720p, no specials — lean main storyline! 🎯🪶`,
        `Unmonitoring specials for '${title}' in 720p! Core episodes only, super efficient. ⚡`,
        `'${title}' — 720p, main episodes only. Maximum efficiency! 📺`,
        `Specials off, 720p on for '${title}'! Streamlined and lightweight. 🧹`,
        `Got it! '${title}' main storyline only in 720p — trim and terrific! 💪`,
      ],
    },
    "480p": {
      future: [
        `'${title}' in 480p, future episodes only! Tiny files for every new episode. 📡📼`,
        `Future episodes of '${title}' in SD! Your storage will barely blink. 💾`,
        `480p and future-only for '${title}'! The most storage-efficient setup possible. 🦸`,
        `'${title}' — 480p, future episodes only. Lean machine mode! 🤖`,
        `Got it! '${title}' future episodes in 480p. Microscopic files, maximum content! 🤏`,
      ],
      missing: [
        `'${title}' in 480p — tracking down missing episodes in retro resolution! 🔍📼`,
        `Missing episodes of '${title}' in 480p! Filling gaps with minimal footprint. 🧩`,
        `480p for '${title}' missing and future episodes! So tiny, so efficient. 🤏`,
        `'${title}' — hunting down what's missing in 480p. Your hard drive won't even notice! 💾`,
        `Got it! Missing episodes of '${title}' in 480p — gap-filling on a diet! 🥗`,
      ],
      existing: [
        `'${title}' in 480p — existing and future episodes in classic SD! 📦📼`,
        `480p for '${title}'! Existing and future episodes, ultra-light. 🪶`,
        `'${title}' — existing and upcoming in 480p. The minimalist's dream! 🧘`,
        `Monitoring '${title}' in 480p! What you have plus what's coming — barely any space used. 💾`,
        `Got it! '${title}' in 480p for existing and future episodes. Storage hero mode! 🦸`,
      ],
      recent: [
        `'${title}' in 480p — recent episodes, barely any storage used! 📅📼`,
        `Recent mode for '${title}' in 480p! Last 90 days in classic resolution. 🕹️`,
        `480p and recent for '${title}'! Fresh content, vintage resolution. ⚡`,
        `'${title}' — recent and future in 480p. Retro quality, modern schedule! 📺`,
        `Got it! '${title}' in 480p, recent episodes. Maximum efficiency achieved! 🏆`,
      ],
      pilot: [
        `'${title}' pilot in 480p — the absolute smallest test-drive possible! 🤏🎬`,
        `Just the pilot of '${title}' in 480p! One episode, barely any space. Ultimate trial! 📼`,
        `'${title}' pilot in SD — blink and you'll miss the file size! Downloading! 💨`,
        `One episode of '${title}' in 480p! The commitment level is basically zero. 😄`,
        `Got it! '${title}' pilot in 480p. The tiniest possible taste of a new show! 🤏`,
      ],
      firstSeason: [
        `First season of '${title}' in 480p! A whole season that takes up almost nothing. 📼`,
        `Season one of '${title}' in 480p — retro resolution for a full season binge! 🕹️`,
        `'${title}' first season in SD! Your storage won't even flinch. 💪💾`,
        `Just season one of '${title}' in 480p — an entire season in the space of one HD movie! 🤏`,
        `Got it! Season one of '${title}' in 480p. Vintage vibes, full season! 📺`,
      ],
      lastSeason: [
        `Latest season of '${title}' in 480p! Straight to the point, minimum space! 🏃📼`,
        `'${title}' last season in 480p — cutting to the chase, saving all the space! ✂️💾`,
        `Most recent season of '${title}' in SD! Who needs pixels when you have plot? 😄`,
        `Last season of '${title}' in 480p — the no-frills express! 🚂`,
        `Got it! '${title}' latest season in 480p — fast, small, done! ⚡`,
      ],
      monitorSpecials: [
        `Specials for '${title}' in 480p! Bonus content that barely takes up any room. 🎁📼`,
        `'${title}' special episodes in SD — the extras in classic resolution! 🕹️`,
        `Monitoring specials of '${title}' in 480p! Retro bonus content! 📺`,
        `480p specials for '${title}'! All the extras, barely any space. 🤏`,
        `Got it! '${title}' specials in 480p — storage-friendly bonus content! 💾`,
      ],
      unmonitorSpecials: [
        `'${title}' in 480p, no specials — pure main storyline, pure efficiency! 🎯📼`,
        `Unmonitoring specials for '${title}' in 480p! Core content only, maximum savings. 💰`,
        `'${title}' — 480p, main episodes only. The most efficient setup known to man! 🦸`,
        `Specials off, 480p on for '${title}'! Absolute minimum storage usage. 📺`,
        `Got it! '${title}' main storyline only in 480p — lean, mean, streaming machine! 💪`,
      ],
    },
  }

  const qualityGroup = comboMessages[label]
  if (!qualityGroup) return randomSeriesMonitorDownloadStartMessage(series, monitor)

  const messages = qualityGroup[monitor]
  if (!messages || messages.length === 0) return randomSeriesMonitorDownloadStartMessage(series, monitor)

  return pickRandom(messages)
}

export const randomSeriesMonitorChangeToAllMessage = (seriesTitle: string) => {
  const messages = [
    `You're not the first to request ${seriesTitle}! Upgrading to monitor all seasons now. 📈`,
    `${seriesTitle} is already here with selective monitoring. As it's so popular I'll download everything! 🌟`,
    `Found ${seriesTitle} with limited monitoring. Since more than one person wants it, I'm grabbing all seasons now. 🎯`,
    `${seriesTitle} was on a restricted diet, but popular demand says otherwise. Downloading all seasons now! 🔥`,
    `${seriesTitle} exists with partial monitoring. Multiple people want it, so I'm upgrading to the full series! 🚀`,
    `${seriesTitle} was already added but not completely. Due to multiple requests, downloading all seasons now. 📺`,
    `${seriesTitle} is in the library with selective monitoring. Expanding to all seasons based on demand! 💯`,
    `${seriesTitle} was partially monitored, but it's clearly popular. Switching to monitor and download everything! 🎉`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

// Monitor change messages
export const randomMonitorUpgradeMessage = (
  seriesTitle: string,
  oldMonitor: string,
  newMonitor: string,
): string => {
  const messages = [
    `Upgraded ${seriesTitle} from "${oldMonitor}" to "${newMonitor}" — more content incoming! 📈`,
    `${seriesTitle} monitoring expanded from "${oldMonitor}" to "${newMonitor}". Get ready for more episodes! 🚀`,
    `Leveling up! ${seriesTitle} now monitors "${newMonitor}" instead of just "${oldMonitor}". 🎯`,
    `${seriesTitle} just got a monitoring upgrade: "${oldMonitor}" → "${newMonitor}". Searching for new content now! 🔍`,
    `Expanding coverage for ${seriesTitle}! Changed from "${oldMonitor}" to "${newMonitor}". 🌟`,
    `${seriesTitle} monitoring boosted from "${oldMonitor}" to "${newMonitor}". More episodes, more fun! 🎬`,
    `Successfully upgraded ${seriesTitle} to monitor "${newMonitor}" (was "${oldMonitor}"). Grabbing additional content! ⬆️`,
    `${seriesTitle} is now monitoring "${newMonitor}" instead of "${oldMonitor}". Expanding your collection! 📺`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomMonitorDowngradeMessage = (
  seriesTitle: string,
  oldMonitor: string,
  newMonitor: string,
): string => {
  const messages = [
    `${seriesTitle} monitoring trimmed from "${oldMonitor}" to "${newMonitor}". Keeping it focused! 🎯`,
    `Scaled back ${seriesTitle} from "${oldMonitor}" to "${newMonitor}". Less is sometimes more! 📉`,
    `${seriesTitle} now monitors "${newMonitor}" instead of "${oldMonitor}". Streamlining your collection! ✂️`,
    `Downgraded ${seriesTitle} monitoring: "${oldMonitor}" → "${newMonitor}". Focusing on what matters! 🔽`,
    `${seriesTitle} monitoring adjusted from "${oldMonitor}" to "${newMonitor}". Curating carefully! 🎨`,
    `Changed ${seriesTitle} to monitor "${newMonitor}" (was "${oldMonitor}"). Keeping it lean! 💨`,
    `${seriesTitle} monitoring refined from "${oldMonitor}" to "${newMonitor}". Quality over quantity! ⭐`,
    `Successfully downgraded ${seriesTitle} to "${newMonitor}" from "${oldMonitor}". Selective approach activated! 🎬`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomMonitorAddedToPoolMessage = (
  seriesTitle: string,
  monitor: string,
): string => {
  const messages = [
    `Added ${seriesTitle} to your pool with "${monitor}" monitoring. It's now being tracked! 📋`,
    `${seriesTitle} joined your pool! Monitoring set to "${monitor}". 🎉`,
    `Welcome ${seriesTitle} to your collection! Now monitoring "${monitor}". ✨`,
    `${seriesTitle} has been added to your pool with "${monitor}" monitoring active. 🌟`,
    `Pool updated! ${seriesTitle} is now in with "${monitor}" monitoring. 📺`,
    `${seriesTitle} successfully added to your pool, monitoring "${monitor}". 🎬`,
    `New addition! ${seriesTitle} is in your pool with "${monitor}" monitoring enabled. 🚀`,
    `${seriesTitle} added! Your pool now includes this series with "${monitor}" monitoring. 🎯`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomEpisodesDownloadingMessage = (count: number, timeleft?: string): string => {
  let eta = ""
  let longWaitNote = ""

  if (timeleft) {
    const duration = moment.duration(timeleft)
    const formatted = formatTimeLeft(timeleft)
    eta = ` — last one finishes in ${formatted}`

    if (duration.asHours() > 8) {
      const note = longWaitComments[Math.floor(Math.random() * longWaitComments.length)]
      longWaitNote = ` — ${note}`
    }
  }

  const messages = [
    `I'm already downloading ${count} episode${
      count > 1 ? "s" : ""
    }. They're coming!${eta}${longWaitNote}`,
    `${count} episode${
      count > 1 ? "s" : ""
    } are already on their way — sit tight!${eta}${longWaitNote}`,
    `Hang tight! I'm already fetching ${count} episode${
      count > 1 ? "s" : ""
    }.${eta}${longWaitNote}`,
    `Already working on it — ${count} episode${
      count > 1 ? "s" : ""
    } are in the pipe.${eta}${longWaitNote}`,
    `No need to worry, ${count} episode${
      count > 1 ? "s" : ""
    } are already being downloaded.${eta}${longWaitNote}`,
    `I'm already on it! ${count} episode${
      count > 1 ? "s" : ""
    } are currently downloading.${eta}${longWaitNote}`,
    `This series is already in the library. ${count} episode${
      count > 1 ? "s" : ""
    } are being downloaded now.${eta}${longWaitNote}`,
    `Already added! ${count} episode${
      count > 1 ? "s" : ""
    } are coming your way.${eta}${longWaitNote}`,
  ]

  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomPositiveComment = (mention: string): string => {
  const messages = [
    `${mention}, you're leveling up! 📈`,
    `Whoa ${mention}, look at that new max! 🚀`,
    `More to love, ${mention}. Enjoy! 🍿`,
    `You're moving up in the world, ${mention}! 🙌`,
    `Limit? What limit? Go wild, ${mention}! 🎉`,
    `You're unstoppable now, ${mention}! 🏆`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomSadComment = (mention: string): string => {
  const messages = [
    `Aw, ${mention}... your wings have been clipped. 🥲`,
    `Someone's on a limit diet... sorry ${mention}! 🍽️`,
    `Back to basics, ${mention}. 😔`,
    `The binge must wait, ${mention}. 📉`,
    `Cutbacks hit hard, huh ${mention}? 💸`,
    `Less is more... or is it? 😬 Sorry, ${mention}.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomRemovalSuccessMessage = (poolItemTitle: string, contentType: string): string => {
  const messages = [
    `I've removed ${poolItemTitle} from your ${contentType} pool. More space for fun!`,
    `Gone! ${poolItemTitle} has been booted from your ${contentType} stash.`,
    `Tossed ${poolItemTitle} out of your ${contentType} collection. Fresh start vibes!`,
    `${poolItemTitle} is history. Your ${contentType} pool just got lighter.`,
    `Snip snip ✂️ — ${poolItemTitle} has been cut from your ${contentType} lineup.`,
    `Out with the old! ${poolItemTitle} no longer lives in your ${contentType} list.`,
    `Declutter mode: activated. ${poolItemTitle} is gone from your ${contentType} zone.`,
    `I've banished ${poolItemTitle} from your ${contentType} pool. May it rest in pieces.`,
    `${poolItemTitle}? Never heard of it. It's out of your ${contentType} pool!`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomMovieReplacementMessage = (title: string): string => {
  const messages = [
    `The movie file for ${title} has been deleted. Onward to a better version! 🚀`,
    `Bye-bye, old ${title}! A fresh copy is now being summoned. 🔍`,
    `${title} has been kicked out. Let the great hunt for a new one begin! 🎯`,
    `The file for ${title} was wiped from existence. Searching for a worthy successor! 🔄`,
    `That version of ${title} didn't make the cut. A new one is now en route! 🎬`,
    `Out with the bad, in with the better — ${title} is getting a makeover. 🧹`,
    `${title} has been deleted from the archives. Starting the quest for redemption! 🧭`,
    `I've nuked ${title}. Now scanning the galaxies for a cleaner cut. 🛸`,
    `Mission delete complete: ${title}. Fresh download incoming! 📡`,
    `${title} got the chop. Let's fetch a shinier copy, shall we? ✨`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomEpisodeReplacementMessage = (
  title: string,
  seasonNumber: number,
  episodeNumber: number,
): string => {
  const messages = [
    `Season ${seasonNumber}, Episode ${episodeNumber} of ${title} has been purged! Dispatching the search droids for a better copy. 🤖📡`,
    `Evicted: ${title} S${seasonNumber.toString().padStart(2, "0")}E${episodeNumber
      .toString()
      .padStart(2, "0")}. Scanning the multiverse for a cleaner version! 🌌`,
    `That episode of ${title} (S${seasonNumber}E${episodeNumber})? Gone. A shiny replacement is now on the way! ✨`,
    `Buh-bye, glitchy ${title} S${seasonNumber}E${episodeNumber}. Summoning a fresher copy from the ether! 🪄`,
    `${title} S${seasonNumber}E${episodeNumber} didn't make the cut. Starting the hunt for a superior one! 🎯`,
    `S${seasonNumber}E${episodeNumber} of ${title} has been deleted from the sacred archives. A new challenger approaches! 🗃️⚔️`,
    `Out with the corrupted ${title} S${seasonNumber}E${episodeNumber}, in with the crisp HD glory. 🔄`,
    `${title} episode S${seasonNumber}E${episodeNumber} has left the building. Let's roll the dice for a better file! 🎲`,
    `*Zap!* ${title} S${seasonNumber}E${episodeNumber} is history. Radar's up for a fresh version. 📡🛰️`,
    `${title} S${seasonNumber}E${episodeNumber} got the boot. Commencing the redemption download arc! 📥⚙️`,
  ]

  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomEpisodeReadyMessage = (
  user: string,
  seriesTitle: string,
  episode: Episode,
): string => {
  const { seasonNumber, episodeNumber, title } = episode
  const messages = [
    `🎉 Hey ${user}, \`${seriesTitle}\` S${seasonNumber}E${episodeNumber} - *${title}* has landed! 🍿`,
    `📥 Success! \`${seriesTitle}\` S${seasonNumber}E${episodeNumber} (*${title}*) is downloaded and ready.`,
    `🚀 ${user}, the mission was a success — \`${seriesTitle}\` S${seasonNumber}E${episodeNumber} (*${title}*) is here!`,
    `✨ All set! \`${seriesTitle}\` S${seasonNumber}E${episodeNumber} (*${title}*) has arrived.`,
    `🎬 Showtime! \`${seriesTitle}\` S${seasonNumber}E${episodeNumber}: *${title}* is ready to roll.`,
    `✅ Done! \`${seriesTitle}\` S${seasonNumber}E${episodeNumber} - *${title}* is now in your library.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomEpisodeStillNotDownloadedMessage = (
  seriesTitle: string,
  episode: Episode,
): string => {
  const { seasonNumber, episodeNumber, title } = episode
  const messages = [
    `⏳ No luck. \`${seriesTitle}\` S${seasonNumber}E${episodeNumber} (*${title}*) is still MIA.`,
    `📡 Searched everywhere — \`${seriesTitle}\` S${seasonNumber}E${episodeNumber} (*${title}*) hasn't arrived.`,
    `🚫 Timeout reached. \`${seriesTitle}\` S${seasonNumber}E${episodeNumber}: *${title}* never showed.`,
    `🕵️‍♂️ Looked under every rock, but \`${seriesTitle}\` S${seasonNumber}E${episodeNumber} (*${title}*) is still missing.`,
    `🔍 \`${seriesTitle}\` S${seasonNumber}E${episodeNumber} (*${title}*) refused to download. How rude.`,
    `⏰ Time's up. \`${seriesTitle}\` S${seasonNumber}E${episodeNumber} (*${title}*) hasn't been found.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomCrashedMessage = (err: unknown): string => {
  const errStr = err instanceof Error ? err.message : String(err)

  const messages = [
    `💥 Something exploded while handling your request. My sincerest digital apologies: ${errStr}`,
    `Blaah aghh uuuug... I crashed 💀. Here's a load of error crap: ${errStr}`,
    `I do apologise. I crashed 💀. I need to puke out a bunch of error mumbo jumbo: ${errStr}`,
    `⚠️ Well... that broke. Here's the mess I made: ${errStr}`,
    `😵 That didn't go well. Here's what the server had to say: ${errStr}`,
  ]

  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomMonitorSpecialsMessage = (seriesTitle: string): string => {
  const messages = [
    `All specials for ${seriesTitle} are now being monitored! Starting a search for bonus content. 🎁`,
    `Special episodes activated for ${seriesTitle}! Searching for all the extra goodies now. ✨`,
    `${seriesTitle} specials are now on the radar! Hunting down those director's cuts and bonuses. 🔍`,
    `Monitoring specials for ${seriesTitle}! Time to grab those OVAs, extras, and special episodes. 🎬`,
    `${seriesTitle} just got the special treatment! Searching for all bonus episodes now. 🌟`,
    `Specials enabled for ${seriesTitle}! Scouring the archives for extra content. 📺`,
    `${seriesTitle} specials are now being tracked! Initiating search for all the bonus material. 🚀`,
    `Special episodes for ${seriesTitle} are now monitored! Let's find those hidden gems. 💎`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomUnmonitorSpecialsMessage = (seriesTitle: string): string => {
  const messages = [
    `Specials for ${seriesTitle} will no longer be monitored. Any existing special episodes will be removed. 🗑️`,
    `${seriesTitle} specials have been unmonitored. Bonus content will be cleaned up. 🧹`,
    `Special episodes for ${seriesTitle} are now off the list. They'll be removed from your library. ✂️`,
    `${seriesTitle} is dropping the specials! All bonus episodes will be deleted. 📉`,
    `Unmonitored specials for ${seriesTitle}. Say goodbye to those extras! 👋`,
    `${seriesTitle} specials have been disabled. Clearing out the bonus content now. 🚮`,
    `No more specials for ${seriesTitle}! Existing special episodes will be purged. 🔥`,
    `${seriesTitle} specials are history! All bonus episodes will be removed from storage. 📦`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

// Random messages for when a user's quality argument doesn't match any available profile
export const randomQualityNotFoundMessage = (qualityArg: string, availableProfiles: string[]): string => {
  const profileList = availableProfiles.join(", ")
  const messages = [
    `I couldn't find a quality profile matching "${qualityArg}". Available profiles: ${profileList}`,
    `Hmm, "${qualityArg}" doesn't match any of our profiles. Try one of these: ${profileList}`,
    `No luck with "${qualityArg}"! Our available profiles are: ${profileList}`,
    `"${qualityArg}"? I don't have a profile for that. Here's what I've got: ${profileList}`,
    `I looked everywhere but "${qualityArg}" didn't match anything. Pick from: ${profileList}`,
    `That quality isn't available I'm afraid. "${qualityArg}" didn't match any profile. Options: ${profileList}`,
    `"${qualityArg}" drew a blank! These are the profiles I know about: ${profileList}`,
    `No profile found for "${qualityArg}". Maybe try one of these instead? ${profileList}`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}
