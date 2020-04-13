const path = require('path')
const express = require('express')
const xss = require('xss')
const NotesService = require('./notes-service')

const notesRouter = express.Router()
const jsonParser = express.json()

const sanitizeNote = note => ({
  id: note.id,  
  note_name: xss(note.note_name),
  modified_date: note.modified_date,
  content: xss(note.content),
  folder_id: note.folder_id  
})

notesRouter
  .route('/')
  .get((req, res, next) => {
    const knexInstance = req.app.get('db')
    NotesService.getAllNotes(knexInstance)
      .then(notes => {
        res.json(notes.map(sanitizeNote))
      })
      .catch(next)
  })
  .post(jsonParser, (req, res, next) => {
    const { note_name, folder_id, content } = req.body
    const newNote = { note_name, folder_id, content }
    const knexInstance = req.app.get('db')

    for (const [key, value] of Object.entries(newNote))
      if (value == null) 
        return res.status(400).json({
          error: { message: `Missing '${key}' in request body` }
        })
        
    NotesService.insertNote(knexInstance, newNote)
      .then(note => {
        res
          .status(201)
          // .location(req.originalUrl + `/${note.id}`)
          .location(path.posix.join(req.originalUrl, `/${note.id}`))
          .json(sanitizeNote(note))
      })
      .catch(next)
  })

notesRouter
  .route('/:note_id')
  .all((req, res, next) => {
    const knexInstance = req.app.get('db')
    NotesService.getById(knexInstance, req.params.note_id)
      .then(note => {
        if (!note) {
          return res.status(404).json({
            error: { message: `Note doesn't exist` }
          })
        }
        res.note = note //save the note for use in the next middleware
        next() //make sure the next middleware is called
      })
      .catch(next)
  })
  .get((req, res, next) => {    
    res.json(sanitizeNote(res.note))      
  })
  .delete((req,res,next) => {
    const knexInstance = req.app.get('db')
    NotesService.deleteNote(knexInstance, req.params.note_id)
    .then(() => {
      res.status(204).end()
    })
    .catch(next)
  })
  .patch(jsonParser, (req, res, next) => {
    const { note_name } = req.body
    const noteToUpdate = { note_name }

    const numberOfValues = Object.values(noteToUpdate).filter(Boolean).length
    if (numberOfValues === 0) {
      return res.status(400).json({ error: { message: `Request body must contain a 'name'`}
      })
    }
    const knexInstance = req.app.get('db')
    NotesService.updateNote(
      knexInstance, 
      req.params.note_id, 
      noteToUpdate
      )
      .then(numRowsAffected => {
        res.status(204).end()
      })
      .catch(next)    
  })

module.exports = notesRouter