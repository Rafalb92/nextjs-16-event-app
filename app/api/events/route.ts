import { type NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import connectDB from '@/lib/mongodb';
import Event from '@/database/event.model';

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const formData = await req.formData();

    // 1) weź tylko stringi z formData -> eventFields: Record<string, string>
    const eventFields = Object.fromEntries(
      Array.from(formData.entries()).filter(([, v]) => typeof v === 'string'),
    ) as Record<string, string>;

    // 2) weź plik
    const file = formData.get('image');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: 'Image file is required' },
        { status: 400 },
      );
    }

    // 3) JSON-y z typami
    const tags = JSON.parse(eventFields['tags'] ?? '[]') as string[];
    const agenda = JSON.parse(eventFields['agenda'] ?? '[]') as unknown[]; // podmień na swój typ

    // 4) upload do Cloudinary z mocnym typem wyniku
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { resource_type: 'image', folder: 'DevEvent' },
            (error, result) => {
              if (error || !result)
                return reject(error ?? new Error('Upload failed'));
              resolve(result);
            },
          )
          .end(buffer);
      },
    );

    // 5) Złóż payload do bazy – bez `let event`
    const payload = {
      ...eventFields,
      // nadpisz pola, które były stringami JSON:
      tags,
      agenda,
      image: uploadResult.secure_url,
    };

    const createdEvent = await Event.create(payload);

    return NextResponse.json(
      { message: 'Event created successfully', event: createdEvent },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        message: 'Event Creation Failed',
        error: e instanceof Error ? e.message : 'Unknown',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    await connectDB();

    const events = await Event.find().sort({ createdAt: -1 });

    return NextResponse.json(
      { message: 'Events fetched successfully', events },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      { message: 'Event fetching failed', error: e },
      { status: 500 },
    );
  }
}
