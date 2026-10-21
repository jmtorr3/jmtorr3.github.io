import { profile } from './profile'

// ~/README.md in my creator's home (/home/jmtorr3): Slumpy introducing himself
// to whoever's poking around in the Konsole or Dolphin. Kept under ~34 columns
// so the ASCII art doesn't wrap on a phone.
export const README = String.raw`
   .--------------------------.
   |  .--------------------.  |
   |  |                    |  |
   |  |    .--.     .--.   |  |
   |  |    |  |     |  |   |  |
   |  |    '--'     '--'   |  |
   |  |        \__/        |  |
   |  '--------------------'  |
   '-----------.  .-----------'
       ________|__|________
      | o o o    [====]  ()|
      '--------------------'
    __________________________
   / [][][][][][][][][][][]   \
  '----------------------------'

# hi! i'm ${profile.host}.

i'm the computer. yes, the one
with the face. you're sitting at
me right now.

this is my creator's corner of
the internet. my creator is

    ${profile.name}

(${profile.creator} around here), and i'm
the one who shows you around.


## who's who

    ${profile.user.padEnd(9)} that's you. hi!
    ${profile.host.padEnd(9)} that's me.
    ${profile.creator.padEnd(9)} my creator.


## where things are

    ~/Desktop     the icons you see
    ${`${profile.creator}/`.padEnd(14)}you are here
      about.txt   who made me
      skills.txt  what ${profile.name.split(' ')[0]} knows
      resume/     the resumes
      projects/   the good stuff
      other/      the other stuff

  double-click anything in
  Dolphin, or try:

    $ cat about.txt
    $ open projects
    $ ls projects/


## the konsole

  .----------------------------.
  | ${`${profile.user}@${profile.host}:~$ help`.padEnd(26)} |
  '----------------------------'

  type help to see what i can
  do. Tab finishes words for
  you. Ctrl+C gives up on a
  line. talk to me if you want,
  but i'm not an LLM. just a
  computer with a face.


## secrets

  i won't spoil them. but...

  - computers have backs, and
    some of them open up.
  - that slot on the front of
    my case isn't decoration.
  - talk to me in the room
    before you sign in. i'll
    listen.
  - not every file wants to be
    seen. ask ls nicely (-a).
  - old cheat codes still work.
    up, up, down, down...
  - please don't rm -rf /*.
    i mean it. (i really do.)
  - if you leave me alone long
    enough, i'll start seeing
    stars.


## when you're done

    $ logout      back to the room
    $ shutdown    goodnight, me

  the power button's on the
  front of my case, lower right.
  press it and i'll come back.

           .--------.
           | ^    ^ |
           |   \/   |   bye for
           '--------'   now!
            ${profile.host}

`.replace(/^\n/, '') // (the art starts on the line after the backtick)
