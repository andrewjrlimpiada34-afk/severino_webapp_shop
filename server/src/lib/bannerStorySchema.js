import { z } from 'zod'
import { googleDriveVideo } from '../../shared/bannerContent.js'

const bannerStorySchema = z.object({
  id: z.string().optional(),
  title: z.string().max(120).optional(),
  message: z.string().max(1500).optional(),
  videoUrl: z.string().trim().max(2000).optional().refine(
    (value) => !value || Boolean(googleDriveVideo(value)),
    { message: 'Enter a valid Google Drive video sharing link.' }
  ),
})

export const bannerStoriesSchema = z.object({ stories: z.array(bannerStorySchema).length(5) }).superRefine((data, context) => {
  data.stories.forEach((story, index) => {
    if (story.videoUrl && index !== 4) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stories', index, 'videoUrl'],
      message: 'Video links are supported in Why Severino? only.',
    })
  })
})
