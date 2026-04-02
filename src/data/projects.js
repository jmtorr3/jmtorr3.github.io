export const projects = [
  {
    title: 'Garage64',
    subtitle: 'Custom Entity Model Studio',
    date: 'Spring 2026',
    status: 'active',
    featured: true,
    tech: ['React', 'Three.js', 'Django', 'SQLite', 'Docker'],
    github: 'https://github.com/jmtorr3/Garage64',
    logo: 'https://raw.githubusercontent.com/jmtorr3/Garage64/main/assets/Logo.png',
    images: [
      { src: 'https://raw.githubusercontent.com/jmtorr3/Garage64/main/assets/cover.png', alt: 'Garage64 cover' },
    ],
    bullets: [
      'Full-stack web application serving as a complete suite for designing and exporting custom Minecraft car models (OptiFine CEM) and texture packs.',
      'Engineered a React + Three.js frontend for a real-time 3D workspace — users dynamically compose vehicles by swapping parts and applying custom paint textures.',
      'Developed a Django REST API to manage entity data and created a one-click export generating ready-to-use .jem and .jpm asset files.',
    ],
  },
  {
    title: 'ParkGrid',
    subtitle: 'Campus Parking Solution',
    date: 'Winter 2025',
    status: 'completed',
    tech: ['React', 'Django', 'PostgreSQL', 'Docker', 'Python', 'Django Channels', 'JWT'],
    github: 'https://github.com/jmtorr3/smart-parking',
    demo: 'https://drive.google.com/file/d/1i2iBi6BwchyWwZEsMr-X2uHa96rrrGug/view?usp=sharing',
    images: [
      { src: 'https://raw.githubusercontent.com/jmtorr3/smart-parking/main/dashboard.png', alt: 'Dashboard preview' },
      { src: 'https://raw.githubusercontent.com/jmtorr3/smart-parking/main/Database_Diagram.png', alt: 'ER Diagram' },
    ],
    bullets: [
      'Served as technical lead for a 5-person team, directing project milestones and owning the core full-stack application.',
      'Co-designed the relational database architecture and led the transition from prototype to a polished production version.',
      'Built a Python simulator generating high-frequency occupancy data to stress-test simultaneous sensor updates against PostgreSQL.',
    ],
  },
  {
    title: 'Nintendo DS Security Analysis',
    subtitle: 'Reverse Engineering Research',
    date: 'Winter 2024',
    status: 'completed',
    tech: ['Assembly', 'DeSmuME', 'Ghidra', 'Python'],
    github: null,
    bullets: [
      'Executed dynamic binary analysis on the Nintendo DS architecture using a virtualized lab environment from the Advanced Software Reverse Engineering curriculum.',
      'Reverse-engineered the proprietary Gen 5 Linear Congruential Generator (LCG) encryption protocol to decrypt 220-byte save file structures.',
      'Built a custom Python tool calculating dynamic block shuffling permutations via PID bitmask — enabling binary modification without checksum corruption.',
    ],
  },
  {
    title: 'Proxmox Home Lab',
    subtitle: 'Self-Hosted Infrastructure',
    date: '2021 – Present',
    status: 'ongoing',
    tech: ['Proxmox', 'NixOS', 'Debian', 'Docker', 'OPNsense'],
    github: null,
    bullets: [
      'Built and iterated on a home lab environment for hosting, experimenting, and learning systems concepts hands-on.',
      'Designed network topologies with OPNsense firewall configurations and secure jumpbox deployments for managing remote access.',
      'Configured reproducible NixOS development environments for Linux kernel programming, system-level testing, and self-hosted services.',
    ],
  },
]
