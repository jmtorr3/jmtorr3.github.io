// What day and time it is for the visitor, for Slumpy's seasonal looks: a
// pumpkin face on Halloween, a Santa hat in December, sleepier late at night.
// To preview one any day: ?date=10-31 or ?date=12-25, and ?hour=2 for night.

const params = new URLSearchParams(location.search)

function now() {
  const d = new Date()
  const date = params.get('date')?.match(/^(\d{1,2})-(\d{1,2})$/)
  if (date) d.setMonth(Number(date[1]) - 1, Number(date[2]))
  const hour = params.get('hour')
  if (hour && /^\d{1,2}$/.test(hour)) d.setHours(Number(hour))
  return d
}

export const isHalloween = () => {
  const d = now()
  return d.getMonth() === 9 && d.getDate() === 31
}

export const isDecember = () => now().getMonth() === 11

// midnight to 5am
export const isLateNight = () => now().getHours() < 5
