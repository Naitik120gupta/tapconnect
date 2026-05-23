// src/pages/TapPage.jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TapPage() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/') }, [])
  return null
}
