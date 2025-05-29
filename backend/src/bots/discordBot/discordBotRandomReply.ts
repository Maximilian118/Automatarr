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
