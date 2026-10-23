export type Suspect = {
  id: string;
  name: string;
  mark: string;
  desc: string;
  image: string;
};

export const SUSPECTS: Suspect[] = [
  {
    id: "the-silent-doctor",
    name: "The Silent Doctor",
    mark: "01",
    desc: "A face behind the glass.",
    image: "/suspect-1.svg",
  },
  {
    id: "the-hollow-nurse",
    name: "The Hollow Nurse",
    mark: "02",
    desc: "Footsteps with no shadow.",
    image: "/suspect-1.svg",
  },
  {
    id: "the-faceless-patient",
    name: "The Faceless Patient",
    mark: "03",
    desc: "Someone wearing your clothes.",
    image: "/suspect-1.svg",
  },
  {
    id: "the-night-attendant",
    name: "The Night Attendant",
    mark: "04",
    desc: "A watcher at the end of the hall.",
    image: "/suspect-1.svg",
  },
];
