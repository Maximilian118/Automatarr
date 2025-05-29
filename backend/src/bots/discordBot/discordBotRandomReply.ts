// Just a bit of fun so we don't see the same message everytime

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
    "Old news! You've already grabbed that.",
    "Yep, you've got that one. Impressive attention to detail... not.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomQueuedMessage = (timeLeft?: string) => {
  const time = timeLeft ? ` (ETA: ${timeLeft})` : ""
  const messages = [
    `Your request is queued — waiting for its turn to download${time}.`,
    `It's in line to be downloaded${time}. Hang tight.`,
    `That one's queued${time}. We'll grab it as soon as we can.`,
    `Added to the download queue${time}. Shouldn't be long now.`,
    `Waiting in the queue${time} — we haven't forgotten it.`,
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomDownloadingMessage = (timeLeft?: string) => {
  const time = timeLeft ? ` (ETA: ${timeLeft})` : ""
  const messages = [
    `It's downloading right now${time} — progress is happening.`,
    `Currently being downloaded${time}. You'll have it soon.`,
    `Download in progress${time}. Just a little longer.`,
    `We're on it — that one's coming down as we speak${time}.`,
    `It's actively downloading${time}. Almost there.`,
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
    "It's downloaded but not imported. Only the great server owner can descend from the clouds and fix this.",
  ]
  return messages[Math.floor(Math.random() * messages.length)]
}

const randomImportedMessage = () => {
  const messages = [
    "All done. It's downloaded and added to your library.",
    "Finished and imported — it should be ready to watch.",
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

export const getStatusMessage = (status: string, time?: string): string => {
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
