export default function SectionDivider({ text = "oppure" }) {
    return (
        <div className="text-center position-relative my-4">
            <hr style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }} />
            <span
                className="position-absolute top-50 start-50 translate-middle px-3"
                style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    color: '#b8b8ff',
                    fontSize: '0.9rem'
                }}
            >
                {text}
            </span>
        </div>
    );
}
