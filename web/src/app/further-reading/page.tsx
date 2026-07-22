type Work = {
  title: string;
  subtitle?: string;
  year: number;
  publisher?: string;
  note?: string;
  honors?: string;
};

const CORE_WORKS: Work[] = [
  {
    title: "Reconstruction",
    subtitle: "America's Unfinished Revolution, 1863–1877",
    year: 1988,
    publisher: "Harper & Row",
    note: "The standard one-volume history of the period this archive documents; reissued with a new introduction in 2014.",
    honors: "Bancroft Prize, Parkman Prize, Los Angeles Times Book Prize; Pulitzer Prize finalist",
  },
  {
    title: "A Short History of Reconstruction",
    year: 1990,
    publisher: "Harper & Row",
    note: "An abridged version of the 1988 volume above; reissued with a new introduction in 2014.",
  },
  {
    title: "Nothing But Freedom",
    subtitle: "Emancipation and Its Legacy",
    year: 1983,
    publisher: "Louisiana State University Press",
    note: "Comparative essays on emancipation's aftermath in the U.S. South, the Caribbean, and Africa.",
  },
  {
    title: "Freedom's Lawmakers",
    subtitle: "A Directory of Black Officeholders During Reconstruction",
    year: 1993,
    publisher: "Oxford University Press",
    note: "Revised edition, LSU Press, 1996. A biographical reference directly relevant to identifying people named in field-office records like these.",
  },
  {
    title: "America's Reconstruction",
    subtitle: "People and Politics after the Civil War",
    year: 1995,
    publisher: "HarperCollins",
    note: "With Olivia Mahoney; companion to a traveling exhibition originating at the Virginia Historical Society.",
  },
  {
    title: "Forever Free",
    subtitle: "The Story of Emancipation and Reconstruction",
    year: 2005,
    publisher: "Knopf",
    note: "A heavily illustrated narrative history covering the same field-office era as this archive.",
  },
  {
    title: "The Second Founding",
    subtitle: "How the Civil War and Reconstruction Remade the Constitution",
    year: 2019,
    publisher: "W. W. Norton",
    note: "A legal and political history of the Thirteenth, Fourteenth, and Fifteenth Amendments.",
  },
  {
    title: "The Fiery Trial",
    subtitle: "Abraham Lincoln and American Slavery",
    year: 2010,
    publisher: "W. W. Norton",
    note: "Lincoln's evolving position on slavery and emancipation, immediately preceding the Reconstruction period.",
    honors: "Pulitzer Prize for History, Bancroft Prize, Lincoln Prize",
  },
  {
    title: "Gateway to Freedom",
    subtitle: "The Hidden History of the Underground Railroad",
    year: 2015,
    publisher: "W. W. Norton",
    note: "Pre-war antecedents to the emancipation and freedom narratives this archive's records document.",
  },
];

const COLUMBIA_WORKS: Work[] = [
  {
    title: "Dance for a City",
    subtitle: "Fifty Years of the New York City Ballet",
    year: 1999,
    publisher: "Columbia University Press",
    note: "Co-edited with Lynn Garafola. Not related to Reconstruction — included here because it is Foner's one book published directly by Columbia University Press.",
  },
  {
    title: "Contested Democracy",
    subtitle: "Freedom, Race, and Power in American History",
    year: 2007,
    publisher: "Columbia University Press",
    note: "Edited by Manisha Sinha and Penny Von Eschen — a festschrift of essays by other historians honoring Foner's work, not authored or edited by Foner himself.",
  },
];

const COLUMBIA_PROJECTS = [
  {
    title: "Columbia and Slavery Project",
    note: "Foner directs this Columbia University research initiative documenting the university's historical links to slavery.",
  },
  {
    title: "Columbia American History Online",
    note: "A Columbia-produced digital history resource; won the Association of American Publishers' award for Electronic Product of the Year, 2003.",
  },
];

const OTHER_WORKS: Work[] = [
  { title: "America's Black Past", subtitle: "A Reader in Afro-American History", year: 1971, publisher: "Harper & Row" },
  { title: "Nat Turner", year: 1971, publisher: "Prentice-Hall" },
  { title: "Free Soil, Free Labor, Free Men", subtitle: "The Ideology of the Republican Party before the Civil War", year: 1970, publisher: "Oxford University Press" },
  { title: "Tom Paine and Revolutionary America", year: 1976, publisher: "Oxford University Press" },
  { title: "Politics and Ideology in the Age of the Civil War", year: 1980, publisher: "Oxford University Press" },
  { title: "A House Divided", subtitle: "America in the Age of Lincoln", year: 1990, publisher: "W. W. Norton", note: "With Olivia Mahoney." },
  { title: "The New American History", year: 1990, publisher: "Temple University Press", note: "Editor; revised and expanded edition, 1997." },
  { title: "The Reader's Companion to American History", year: 1991, publisher: "Houghton Mifflin", note: "Co-edited with John A. Garraty." },
  { title: "Thomas Paine", year: 1995, publisher: "Library of America", note: "Editor." },
  { title: "The Story of American Freedom", year: 1998, publisher: "W. W. Norton" },
  { title: "Who Owns History?", subtitle: "Rethinking the Past in a Changing World", year: 2002, publisher: "Hill and Wang" },
  { title: "Give Me Liberty!", subtitle: "An American History", year: 2004, publisher: "W. W. Norton", note: "Widely used survey textbook; multiple editions." },
  { title: "Voices of Freedom", subtitle: "A Documentary History", year: 2004, publisher: "W. W. Norton" },
  { title: "Herbert Aptheker on Race and Democracy", subtitle: "A Reader", year: 2006, publisher: "University of Illinois Press", note: "Co-edited with Manning Marable." },
  { title: "Our Lincoln", subtitle: "New Perspectives on Lincoln and His World", year: 2008, publisher: "W. W. Norton", note: "Editor." },
  { title: "American History Now", year: 2011, publisher: "Temple University Press", note: "Co-edited with Lisa McGirr." },
  { title: "Battles for Freedom", subtitle: "The Use and Abuse of American History", year: 2017, publisher: "I. B. Tauris" },
];

function WorkEntry({ w }: { w: Work }) {
  return (
    <div className="paper-card p-3 rounded flex flex-col gap-1">
      <div className="text-sm font-medium">
        {w.title}
        {w.subtitle && <span style={{ color: "var(--text-secondary)" }}>: {w.subtitle}</span>}
      </div>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        Eric Foner{w.publisher ? ` · ${w.publisher}` : ""} · {w.year}
      </div>
      {w.note && (
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {w.note}
        </div>
      )}
      {w.honors && (
        <div className="text-xs italic" style={{ color: "var(--series-3)" }}>
          {w.honors}
        </div>
      )}
    </div>
  );
}

export default function FurtherReadingPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl">Further Reading: Eric Foner on Reconstruction</h1>
      <p className="text-sm max-w-3xl" style={{ color: "var(--text-secondary)" }}>
        The records in this archive are primary sources: Freedmen&rsquo;s Bureau field-office letters, registers,
        and contracts, transcribed and captioned largely by machine, with no historical interpretation added. Eric
        Foner &mdash; DeWitt Clinton Professor Emeritus of History at Columbia University &mdash; is the preeminent
        historian of the Reconstruction era, and his work is the standard scholarly framework for interpreting what
        these records mean. This page is a bibliography, not a summary of his arguments &mdash; read the books
        themselves for that. Bibliographic details are drawn from Foner&rsquo;s official Columbia University CV.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
          Most directly relevant to this archive
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CORE_WORKS.map((w) => (
            <WorkEntry key={w.title} w={w} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
          Published through Columbia University
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {COLUMBIA_WORKS.map((w) => (
            <WorkEntry key={w.title} w={w} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {COLUMBIA_PROJECTS.map((p) => (
            <div key={p.title} className="paper-card p-3 rounded flex flex-col gap-1">
              <div className="text-sm font-medium">{p.title}</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {p.note}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
          Other works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {OTHER_WORKS.map((w) => (
            <WorkEntry key={w.title} w={w} />
          ))}
        </div>
      </section>

      <div className="text-xs italic" style={{ color: "var(--text-muted)" }}>
        Publication years and publishers reflect first U.S. edition where known; several titles have since been
        reissued or revised. This list is not affiliated with or endorsed by Eric Foner, Columbia University, or
        any of the publishers named.
      </div>
    </div>
  );
}
