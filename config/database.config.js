import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URL) {
      console.log("> Missing MongoDB connection String");
      process.exit(1);
    }

    const conn = await mongoose.connect(process.env.MONGODB_URL);
    console.log(`> MongoDB Connected`);
  } catch (error) {
    console.error(`> Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
