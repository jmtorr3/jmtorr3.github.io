import { roomChat, TYPED_LENGTH } from './PCModel'

// Phones: tapping Chiba (the 3D keyboard) in the room brings up the phone's own
// keyboard, to talk to Slumpy. A hidden text box takes the typing and passes the
// line to the room (his screen turns into a command line, like typing on a
// computer); Enter (go / return) and he answers.

const box: { current: HTMLInputElement | null } = { current: null }

// (called from the tap itself: phones only open their keyboard for a focus that comes straight from a touch)
export function openRoomKeyboard() {
  const input = box.current
  if (!input) return
  input.value = ''
  input.focus({ preventScroll: true })
}

export function RoomKeyboard() {
  return (
    <form
      className="room-keyboard"
      onSubmit={(e) => {
        e.preventDefault()
        roomChat.current?.enter()
        if (box.current) box.current.value = ''
      }}
    >
      <input
        ref={(el) => {
          box.current = el
        }}
        type="text"
        enterKeyHint="send"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={TYPED_LENGTH}
        aria-label={'talk to the computer'}
        onInput={(e) => roomChat.current?.setLine(e.currentTarget.value)}
      />
    </form>
  )
}
