import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import multer from 'multer';

const app = express();
const port = 3000;

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

app.use(express.json());


const upload = multer({ dest: 'uploads/' });

async function connectToMongo() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    return client.db("eventDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

let db;
connectToMongo().then((database) => {
  db = database;
});


app.get('/api/v3/app/events', async (req, res) => {
  const { id, type, limit = 5, page = 1 } = req.query;

  if (id) {
    try {
      const event = await db.collection("events").findOne({ _id: new ObjectId(id) });
      
      if (event) {
        res.json({ message: "Event retrieved successfully", data: event });
      } else {
        res.status(404).json({ message: "Event not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error retrieving event", error: error.message });
    }
  } else if (type === 'latest') {
   
    try {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const result = await db.collection("events").find()
        .sort({ schedule: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      res.json({ 
        message: "Events retrieved successfully", 
        data: result, 
        page: parseInt(page), 
        limit: parseInt(limit) 
      });
    } catch (error) {
      res.status(500).json({ message: "Error retrieving events", error: error.message });
    }
  } else {
    res.status(400).json({ message: "Invalid query parameters" });
  }
});



app.post('/api/v3/app/events', upload.single('image'), async (req, res) => {
  try {
    const eventData = {
      type: "event",
      uid: parseInt(req.body.uid),
      name: req.body.name,
      tagline: req.body.tagline,
      schedule: new Date(req.body.schedule),
      description: req.body.description,
      moderator: req.body.moderator,
      category: req.body.category,
      sub_category: req.body.sub_category,
      rigor_rank: parseInt(req.body.rigor_rank),
      attendees: [],
      files: req.file ? { image: req.file.path } : {}
    };

    const result = await db.collection("events").insertOne(eventData);
    res.status(201).json({ message: "Event created successfully", id: result.insertedId, data: eventData });
  } catch (error) {
    res.status(500).json({ message: "Error creating event", error: error.message });
  }
});


app.put('/api/v3/app/events/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;

  try {
    const existingEvent = await db.collection("events").findOne({ _id: new ObjectId(id) });

    if (!existingEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

    const updateData = {};
    const fields = ['name', 'tagline', 'schedule', 'description', 'moderator', 'category', 'sub_category', 'rigor_rank'];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'schedule') {
          updateData[field] = new Date(req.body[field]);
        } else if (field === 'rigor_rank') {
          updateData[field] = parseInt(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    if (req.file) {
      updateData.files = { ...existingEvent.files, image: req.file.path };
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const result = await db.collection("events").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    res.json({ 
      message: "Event updated successfully", 
      data: result.value,
      updated_fields: Object.keys(updateData)
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating event", error: error.message });
  }
});


app.delete('/api/v3/app/events/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.collection("events").findOneAndDelete({ _id: new ObjectId(id) });

    if (!result.value) {
      res.status(404).json({ message: "Event not found" });
    } else {
      res.json({ message: "Event deleted successfully", data: result.value });
    }
  } catch (error) {
    res.status(500).json({ message: "Error deleting event", error: error.message });
  }
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

