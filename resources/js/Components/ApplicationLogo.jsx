export default function ApplicationLogo(props) {
    const { className = '', ...rest } = props;

    return (
        <img
            {...rest}
            src="/brand/karsa-logo.png"
            alt="Karsa ERP"
            className={`object-contain ${className}`}
        />
    );
}
