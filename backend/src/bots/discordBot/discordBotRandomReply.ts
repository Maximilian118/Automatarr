// Just a bit of fun so we don't see the same message everytime

import moment from "moment"
import { formatTimeLeft } from "../../shared/utility"
import { Episode } from "../../types/episodeTypes"
import { Movie } from "../../types/movieTypes"
import { MonitorOptions, Series } from "../../types/seriesTypes"

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
  return messages[Math.floor(Math.random() * messages.length)]
}

export const randomSeriesDownloadStartMessage = (series: Series, monitor: MonitorOptions) => {
  // Monitor-specific messages explaining what will be downloaded
  const monitorMessages: Record<MonitorOptions, string[]> = {
    all: [],
    future: [
      "Only future episodes will be grabbed — no backlog binges here!",
      "I'll snag episodes as they air, but the past stays in the past.",
      "Future episodes only — time to catch up on other shows while you wait!",
      "You're living in the now! Only new episodes coming your way.",
    ],
    missing: [
      "I'll grab missing episodes and future releases — filling in those gaps!",
      "Missing episodes detected — time for some digital archaeology!",
      "Tracking down what you're missing, plus keeping up with new episodes.",
      "Past gaps and future releases — I'm on both cases!",
    ],
    existing: [
      "Only monitoring episodes with files or future releases — keeping what you've got!",
      "I'll watch the episodes you have, plus grab new ones as they air.",
      "Existing episodes stay monitored, and future ones will join the party.",
      "Maintaining your current collection and tracking future releases!",
    ],
    recent: [
      "Last 90 days plus future episodes — no ancient history here!",
      "Recent episodes and future releases only — keeping it fresh!",
      "Grabbing the last 90 days worth, plus anything new that drops.",
      "You're in the modern era — recent and future episodes incoming!",
    ],
    pilot: [
      "Just the pilot episode — testing the waters before diving in!",
      "First episode only — gotta see if it's worth the commitment!",
      "Starting with episode one — your toe is officially in the water.",
      "Pilot episode inbound — let's see if this show's got wings!",
    ],
    firstSeason: [
      "Season 1 only — keeping it simple and focused!",
      "Just the first season — a controlled binge situation.",
      "Starting with season one — the rest can wait!",
      "First season on the way — baby steps into the series!",
    ],
    lastSeason: [
      "Latest season only — jumping straight to the good stuff!",
      "Just the most recent season — you're cutting to the chase!",
      "Last season incoming — no time for backstory!",
      "Most recent season only — living on the edge of the plot!",
    ],
    monitorSpecials: [
      "Monitoring special episodes — because bonus content matters!",
      "Specials are coming too — extra goodies included!",
      "Regular episodes plus specials — the full experience!",
      "Special episodes tracked — no director's cuts left behind!",
    ],
    unmonitorSpecials: [
      "Skipping special episodes — just the main storyline for you!",
      "No specials in this batch — keeping it to the core narrative!",
      "Special episodes ignored — mainline content only!",
      "Regular episodes only — specials need not apply!",
    ],
    none: [],
  }

  // Get monitor-specific comment
  const monitorComments = monitorMessages[monitor] || []
  const monitorSpecificComment =
    monitorComments.length > 0
      ? monitorComments[Math.floor(Math.random() * monitorComments.length)]
      : ""

  const messages = [
    `Binge mode: activated! '${series.title}' is on the way. ${monitorSpecificComment} 📺`,
    `Here we go — '${series.title}' is starting to download! ${monitorSpecificComment} 🍿`,
    `'${series.title}' is joining the library. Get comfy! ${monitorSpecificComment} 🛋️`,
    `Episodes inbound! '${series.title}' is downloading now. ${monitorSpecificComment} 🚚`,
    `Get ready for a wild ride — '${series.title}' is coming in hot! ${monitorSpecificComment} 🔥`,
    `One episode at a time... '${series.title}' is on the move! ${monitorSpecificComment} 🎬`,
    `'${series.title}' is headed your way. It's series time! ${monitorSpecificComment} 📦`,
    `Cue the theme song — '${series.title}' is downloading. ${monitorSpecificComment} 🎵`,
    `'${series.title}' is loading up. Snacks not included. ${monitorSpecificComment} 🍪`,
    `📡 Incoming transmission: '${series.title}' has entered the download zone. ${monitorSpecificComment}`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
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
