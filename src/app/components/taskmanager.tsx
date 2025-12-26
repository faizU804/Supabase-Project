"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { supabase } from "../supabase-client";
import { Session } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Loader2, CheckCircle2 } from "lucide-react";

interface Task {
  id: number;
  title: string;
  description: string;
  created_at: string;
  image_url : string
}

export default function TaskManager({ session }: { session: Session }) {
  const [taskForm, setTaskForm] = useState({ title: "", description: "" });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editValue, setEditValue] = useState<{ [key: number]: string }>({});
  const [taskImage , setTaskImage] = useState<File | null>(null)
  // 1. Initial Data Fetch
  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setTasks(data);
  };


  const handleFileChange = (e:ChangeEvent<HTMLInputElement>) => {
        if(e.target.files && e.target.files.length > 0){
            setTaskImage(e.target.files[0])
        }
  }





  // 2. Realtime Listener (The "Source of Truth" for the UI)
  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel("db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTasks((prev) => [payload.new as Task, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) =>
              prev.map((t) => (t.id === payload.new.id ? (payload.new as Task) : t))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  const uploadImage = async (file : File):Promise<string | null> => {
    const filePath = `${file.name}-${Date.now()}`
    const {error} =  await supabase.storage.from("tasks-images").upload(filePath , file)

    if(error){
        console.log("error occurs during file upload images : " , error.message)
        return null
    }

 const {data} =  await supabase.storage.from('tasks-images').getPublicUrl(filePath)
    
    return data.publicUrl
  }






  // 3. Database Actions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // uploading image to supabase 

    let imageUrl:string | null = null
    if(taskImage){
        imageUrl = await uploadImage(taskImage)
    }



    if (!taskForm.title.trim()) return;

    setIsSubmitting(true);
    const { error } = await supabase.from("tasks").insert([
      { 
        title: taskForm.title, 
        description: taskForm.description, 
        email: session.user.email,
        image_url : imageUrl 
      },
    ]);

    if (error) {
      console.error("Submission error:", error.message);
    } else {
      setTaskForm({ title: "", description: "" }); // Reset form
    }
    setIsSubmitting(false);
  };

  const deleteTask = async (id: number) => {
    await supabase.from("tasks").delete().eq("id", id);
  };

  const updateTask = async (id: number) => {
    const newVal = editValue[id];
    if (!newVal) return;
    
    await supabase.from("tasks").update({ description: newVal }).eq("id", id);
    setEditValue((prev) => ({ ...prev, [id]: "" })); // Clear specific input
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        
        {/* Header */}
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Task <span className="text-indigo-600">Flow</span>
          </h1>
          <p className="text-slate-500 mt-2">Logged in as {session.user.email}</p>
        </header>

        {/* Input Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800"
              placeholder="Task title..."
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            />
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800"
              placeholder="Description (optional)"
              rows={2}
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
            />

    <input 
    type="file"
    accept="image/*"
    onChange={handleFileChange}
    />

            <button
              disabled={isSubmitting}
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
              Add Task
            </button>
          </form>
        </motion.div>

        {/* List Section */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {tasks.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: -20 }}
                className="group bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="mt-1 text-indigo-500">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{t.title}</h3>
                      <p className="text-slate-500 text-sm">{t.description}</p>
                      <img src={t.image_url} style={{height :70}}/>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteTask(t.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Inline Edit Row */}
                <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
                  <input 
                    className="flex-1 text-xs bg-slate-50 px-3 py-2 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 transition-all"
                    placeholder="Update details..."
                    value={editValue[t.id] || ""}
                    onChange={(e) => setEditValue({ ...editValue, [t.id]: e.target.value })}
                  />
                  <button 
                    onClick={() => updateTask(t.id)}
                    className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-2 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}