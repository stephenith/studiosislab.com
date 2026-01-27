"use client";

import { useState } from "react";

export default function ResumeEditor({ params }: { params: { id: string } }) {
  // Basic fields
  const [name, setName] = useState("John Doe");
  const [title, setTitle] = useState("UI/UX Designer");
  const [summary, setSummary] = useState(
    "A passionate designer with experience in creating engaging user experiences."
  );

  // Skills
  const [skills, setSkills] = useState<string[]>(["Figma", "React", "UI Design"]);
  const [newSkill, setNewSkill] = useState("");

  // Education
  const [education, setEducation] = useState<
    { degree: string; school: string; year: string }[]
  >([
    {
      degree: "Bachelor of Design",
      school: "ABC Institute of Design",
      year: "2020",
    },
  ]);

  // Experience
  const [experience, setExperience] = useState<
    { role: string; company: string; desc: string }[]
  >([
    {
      role: "UI Designer",
      company: "XYZ Studios",
      desc: "Worked on UI redesign and enhancing user journeys.",
    },
  ]);

  // Projects
  const [projects, setProjects] = useState<
    { title: string; desc: string }[]
  >([
    {
      title: "Portfolio Website",
      desc: "Designed and developed a modern portfolio site.",
    },
  ]);

  // Template Switcher
  const [template, setTemplate] = useState<"A" | "B">("A");

  return (
    <main className="min-h-screen flex flex-col bg-gray-100">

      {/* ---------------- TEMPLATE SWITCHER TOP CENTER ---------------- */}
      <div className="w-full py-4 bg-white shadow flex justify-center gap-4 sticky top-0 z-20">
        <button
          onClick={() => setTemplate("A")}
          className={`px-4 py-2 rounded-md font-semibold ${
            template === "A"
              ? "bg-black text-white"
              : "bg-gray-200 text-black"
          }`}
        >
          Template A
        </button>

        <button
          onClick={() => setTemplate("B")}
          className={`px-4 py-2 rounded-md font-semibold ${
            template === "B"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-black"
          }`}
        >
          Template B
        </button>
      </div>

      <div className="flex flex-1 p-6">

        {/* ---------------- LEFT PANEL ---------------- */}
        <aside className="w-80 bg-white shadow rounded-lg p-4 mr-4 overflow-y-auto">
          <h2 className="font-bold text-lg mb-2">Editor Panel</h2>

          {/* NAME */}
          <div className="mt-4">
            <label className="text-sm font-semibold">Full Name</label>
            <input
              className="w-full p-2 border rounded mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* TITLE */}
          <div className="mt-4">
            <label className="text-sm font-semibold">Title</label>
            <input
              className="w-full p-2 border rounded mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* SUMMARY */}
          <div className="mt-4">
            <label className="text-sm font-semibold">Summary</label>
            <textarea
              className="w-full p-2 border rounded mt-1 h-24"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            ></textarea>
          </div>

          {/* SKILLS */}
          <div className="mt-6">
            <h3 className="font-semibold text-md">Skills</h3>

            <div className="flex mt-2">
              <input
                className="flex-1 p-2 border rounded"
                placeholder="Add skill"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
              />
              <button
                className="ml-2 px-3 bg-blue-500 text-white rounded"
                onClick={() => {
                  if (newSkill.trim()) {
                    setSkills([...skills, newSkill]);
                    setNewSkill("");
                  }
                }}
              >
                Add
              </button>
            </div>

            <ul className="mt-2">
              {skills.map((s, i) => (
                <li key={i} className="flex justify-between text-sm mt-1">
                  {s}
                  <button
                    className="text-red-500 text-xs"
                    onClick={() => setSkills(skills.filter((_, idx) => idx !== i))}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* EDUCATION */}
          <div className="mt-6">
            <h3 className="font-semibold text-md">Education</h3>

            {education.map((ed, i) => (
              <div key={i} className="border p-3 rounded mt-2">
                <input
                  className="w-full p-2 border rounded mt-1"
                  value={ed.degree}
                  onChange={(e) => {
                    const updated = [...education];
                    updated[i].degree = e.target.value;
                    setEducation(updated);
                  }}
                  placeholder="Degree"
                />

                <input
                  className="w-full p-2 border rounded mt-1"
                  value={ed.school}
                  onChange={(e) => {
                    const updated = [...education];
                    updated[i].school = e.target.value;
                    setEducation(updated);
                  }}
                  placeholder="School Name"
                />

                <input
                  className="w-full p-2 border rounded mt-1"
                  value={ed.year}
                  onChange={(e) => {
                    const updated = [...education];
                    updated[i].year = e.target.value;
                    setEducation(updated);
                  }}
                  placeholder="Year"
                />
              </div>
            ))}

            <button
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
              onClick={() =>
                setEducation([...education, { degree: "", school: "", year: "" }])
              }
            >
              Add Education
            </button>
          </div>

          {/* EXPERIENCE */}
          <div className="mt-6">
            <h3 className="font-semibold text-md">Experience</h3>

            {experience.map((ex, i) => (
              <div key={i} className="border p-3 rounded mt-2">
                <input
                  className="w-full p-2 border rounded mt-1"
                  value={ex.role}
                  onChange={(e) => {
                    const updated = [...experience];
                    updated[i].role = e.target.value;
                    setExperience(updated);
                  }}
                  placeholder="Role"
                />

                <input
                  className="w-full p-2 border rounded mt-1"
                  value={ex.company}
                  onChange={(e) => {
                    const updated = [...experience];
                    updated[i].company = e.target.value;
                    setExperience(updated);
                  }}
                  placeholder="Company"
                />

                <textarea
                  className="w-full p-2 border rounded mt-1 h-20"
                  value={ex.desc}
                  onChange={(e) => {
                    const updated = [...experience];
                    updated[i].desc = e.target.value;
                    setExperience(updated);
                  }}
                  placeholder="Description"
                ></textarea>
              </div>
            ))}

            <button
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
              onClick={() =>
                setExperience([...experience, { role: "", company: "", desc: "" }])
              }
            >
              Add Experience
            </button>
          </div>

          {/* PROJECTS */}
          <div className="mt-6">
            <h3 className="font-semibold text-md">Projects</h3>

            {projects.map((pr, i) => (
              <div key={i} className="border p-3 rounded mt-2">
                <input
                  className="w-full p-2 border rounded mt-1"
                  value={pr.title}
                  onChange={(e) => {
                    const updated = [...projects];
                    updated[i].title = e.target.value;
                    setProjects(updated);
                  }}
                  placeholder="Project Title"
                />

                <textarea
                  className="w-full p-2 border rounded mt-1 h-20"
                  value={pr.desc}
                  onChange={(e) => {
                    const updated = [...projects];
                    updated[i].desc = e.target.value;
                    setProjects(updated);
                  }}
                  placeholder="Project Description"
                ></textarea>
              </div>
            ))}

            <button
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
              onClick={() =>
                setProjects([...projects, { title: "", desc: "" }])
              }
            >
              Add Project
            </button>
          </div>
        </aside>

        {/* ---------------- RIGHT PREVIEW ---------------- */}
        <section className="flex-1 bg-white shadow rounded-lg p-10 overflow-y-auto">

          {/* TEMPLATE A - MODERN CLEAN */}
          {template === "A" && (
            <div>
              <h1 className="text-3xl font-bold">{name}</h1>
              <h2 className="text-xl text-gray-600 mt-1">{title}</h2>

              <h3 className="font-semibold text-lg mt-6 mb-1">Summary</h3>
              <p className="text-gray-700">{summary}</p>

              <h3 className="font-semibold text-lg mt-6 mb-1">Skills</h3>
              <ul className="list-disc ml-6 text-gray-700">
                {skills.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>

              <h3 className="font-semibold text-lg mt-6 mb-1">Education</h3>
              {education.map((ed, i) => (
                <p key={i} className="text-gray-700 mt-1">
                  <strong>{ed.degree}</strong> — {ed.school} ({ed.year})
                </p>
              ))}

              <h3 className="font-semibold text-lg mt-6 mb-1">Experience</h3>
              {experience.map((ex, i) => (
                <div key={i} className="mt-2">
                  <p className="font-semibold">{ex.role} — {ex.company}</p>
                  <p className="text-gray-700">{ex.desc}</p>
                </div>
              ))}

              <h3 className="font-semibold text-lg mt-6 mb-1">Projects</h3>
              {projects.map((pr, i) => (
                <div key={i} className="mt-2">
                  <p className="font-semibold">{pr.title}</p>
                  <p className="text-gray-700">{pr.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* TEMPLATE B - BLUE ACCENT */}
          {template === "B" && (
            <div className="border-l-4 pl-6 border-blue-600">

              <h1 className="text-3xl font-bold text-blue-600">{name}</h1>
              <h2 className="text-xl text-gray-700 mt-1">{title}</h2>

              <h3 className="font-semibold text-lg mt-6 mb-1 text-blue-600">
                Summary
              </h3>
              <p className="text-gray-800">{summary}</p>

              <h3 className="font-semibold text-lg mt-6 mb-1 text-blue-600">
                Skills
              </h3>
              <ul className="list-disc ml-6 text-gray-800">
                {skills.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>

              <h3 className="font-semibold text-lg mt-6 mb-1 text-blue-600">
                Education
              </h3>
              {education.map((ed, i) => (
                <p key={i} className="text-gray-800 mt-1">
                  <strong>{ed.degree}</strong> — {ed.school} ({ed.year})
                </p>
              ))}

              <h3 className="font-semibold text-lg mt-6 mb-1 text-blue-600">
                Experience
              </h3>
              {experience.map((ex, i) => (
                <div key={i} className="mt-2">
                  <p className="font-semibold text-blue-600">{ex.role}</p>
                  <p className="text-gray-800">{ex.company}</p>
                  <p className="text-gray-700">{ex.desc}</p>
                </div>
              ))}

              <h3 className="font-semibold text-lg mt-6 mb-1 text-blue-600">
                Projects
              </h3>
              {projects.map((pr, i) => (
                <div key={i} className="mt-2">
                  <p className="font-semibold text-blue-600">{pr.title}</p>
                  <p className="text-gray-800">{pr.desc}</p>
                </div>
              ))}
            </div>
          )}

        </section>
      </div>
    </main>
  );
}